const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
};

const sanitizeSegment = (value) => {
  const sanitized = String(value || '')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized || 'untitled';
};

const isStemMatch = (name, fileStem) => {
  const ext = path.extname(name);
  const baseName = path.basename(name, ext);
  return baseName === fileStem || baseName.startsWith(`${fileStem}-`);
};

const respondJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const readJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
};

const removeEmptyDirectories = async (directory, rootDir) => {
  if (directory === rootDir || !directory.startsWith(rootDir)) {
    return;
  }

  try {
    const entries = await fsp.readdir(directory);
    if (entries.length > 0) {
      return;
    }

    await fsp.rmdir(directory);
    await removeEmptyDirectories(path.dirname(directory), rootDir);
  } catch {
    // Best-effort cleanup.
  }
};

const createServer = ({ distDir, picDbDir, baseDir }) => {
  const snapshotPath = path.join(baseDir, 'app_state_snapshot.json');
  const resolvePicDbPath = async (relativePath) => {
    const primaryPath = path.resolve(picDbDir, relativePath);
    if (primaryPath.startsWith(picDbDir) && fs.existsSync(primaryPath) && fs.statSync(primaryPath).isFile()) {
      return primaryPath;
    }

    const pathSegments = relativePath.split('/').filter(Boolean);
    if (pathSegments.length < 2) {
      return primaryPath;
    }

    const fallbackRelativeSuffix = pathSegments.slice(1);

    try {
      const bookFolders = await fsp.readdir(picDbDir);
      for (const bookFolder of bookFolders) {
        const fallbackPath = path.resolve(picDbDir, bookFolder, ...fallbackRelativeSuffix);
        if (fallbackPath.startsWith(picDbDir) && fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
          return fallbackPath;
        }
      }
    } catch {
      // Ignore fallback failures.
    }

    return primaryPath;
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);

      if (pathname.startsWith('/pic_db/')) {
        const relativePath = pathname.replace(/^\/pic_db\//, '');
        const filePath = await resolvePicDbPath(relativePath);
        if (!filePath.startsWith(picDbDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        res.setHeader('Content-Type', getMimeType(filePath));
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      if (pathname === '/api/save-generated-image' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const remoteUrl = String(body.remoteUrl || '');
        const bookId = sanitizeSegment(body.bookId || 'unknown-book');
        const category = sanitizeSegment(body.category || 'misc');
        const subcategory = sanitizeSegment(body.subcategory || 'misc');
        const fileStem = sanitizeSegment(body.fileStem || `image-${Date.now()}`);

        if (!remoteUrl) {
          respondJson(res, 400, { error: 'remoteUrl is required' });
          return;
        }

        const upstreamResponse = await fetch(remoteUrl);
        if (!upstreamResponse.ok) {
          respondJson(res, 502, { error: `Failed to download remote image: ${upstreamResponse.status}` });
          return;
        }

        const contentType = upstreamResponse.headers.get('content-type') || '';
        const extension =
          contentType.includes('png') ? 'png' :
          contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' :
          contentType.includes('webp') ? 'webp' :
          contentType.includes('gif') ? 'gif' :
          path.extname(new URL(remoteUrl).pathname).replace('.', '') || 'png';

        const directory = path.join(picDbDir, bookId, category, subcategory);
        await fsp.mkdir(directory, { recursive: true });

        const fileName = `${fileStem}.${extension}`;
        const filePath = path.join(directory, fileName);
        const arrayBuffer = await upstreamResponse.arrayBuffer();
        await fsp.writeFile(filePath, Buffer.from(arrayBuffer));

        const siblingFiles = await fsp.readdir(directory);
        await Promise.all(
          siblingFiles
            .filter((name) => name !== fileName && isStemMatch(name, fileStem))
            .map(async (name) => {
              try {
                await fsp.unlink(path.join(directory, name));
              } catch {
                // Best-effort cleanup.
              }
            })
        );

        respondJson(res, 200, {
          localUrl: `/pic_db/${[bookId, category, subcategory, fileName].map(encodeURIComponent).join('/')}`,
        });
        return;
      }

      if (pathname === '/api/delete-generated-image' && req.method === 'DELETE') {
        const body = await readJsonBody(req);
        const localUrl = String(body.localUrl || '');

        if (!localUrl.startsWith('/pic_db/')) {
          respondJson(res, 400, { error: 'localUrl must start with /pic_db/' });
          return;
        }

        const relativePath = decodeURIComponent(localUrl.replace(/^\/pic_db\//, ''));
        const filePath = path.resolve(picDbDir, relativePath);
        if (!filePath.startsWith(picDbDir)) {
          respondJson(res, 400, { error: 'Invalid localUrl' });
          return;
        }

        try {
          const stats = await fsp.stat(filePath);
          if (!stats.isDirectory()) {
            await fsp.unlink(filePath);
            await removeEmptyDirectories(path.dirname(filePath), picDbDir);
          }
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }

        res.statusCode = 204;
        res.end();
        return;
      }

      if (pathname === '/api/check-generated-image' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const localUrl = String(body.localUrl || '');

        if (!localUrl.startsWith('/pic_db/')) {
          respondJson(res, 400, { error: 'localUrl must start with /pic_db/' });
          return;
        }

        const relativePath = decodeURIComponent(localUrl.replace(/^\/pic_db\//, ''));
        const filePath = path.resolve(picDbDir, relativePath);
        const exists = filePath.startsWith(picDbDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
        respondJson(res, 200, { exists });
        return;
      }

      if (pathname === '/api/find-generated-image' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const bookFolder = sanitizeSegment(body.bookFolder || '');
        const category = sanitizeSegment(body.category || 'misc');
        const subcategory = sanitizeSegment(body.subcategory || 'misc');
        const fileStem = sanitizeSegment(body.fileStem || '');

        if (!bookFolder || !fileStem) {
          respondJson(res, 400, { error: 'bookFolder and fileStem are required' });
          return;
        }

        const directory = path.resolve(picDbDir, bookFolder, category, subcategory);
        if (!directory.startsWith(picDbDir) || !fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
          respondJson(res, 200, { localUrl: null });
          return;
        }

        const entries = await fsp.readdir(directory);
        const matchedFile = entries
          .filter((name) => isStemMatch(name, fileStem))
          .sort((a, b) => Number(path.basename(a, path.extname(a)) === fileStem) - Number(path.basename(b, path.extname(b)) === fileStem))
          .at(-1);

        respondJson(res, 200, {
          localUrl: matchedFile
            ? `/pic_db/${[bookFolder, category, subcategory, matchedFile].map(encodeURIComponent).join('/')}`
            : null,
        });
        return;
      }

      if (pathname === '/api/normalize-generated-image' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const localUrl = String(body.localUrl || '');
        const targetBookFolder = sanitizeSegment(body.targetBookFolder || '');
        const category = sanitizeSegment(body.category || 'misc');
        const subcategory = sanitizeSegment(body.subcategory || 'misc');
        const fileStem = sanitizeSegment(body.fileStem || 'image');

        if (!localUrl.startsWith('/pic_db/')) {
          respondJson(res, 400, { error: 'localUrl must start with /pic_db/' });
          return;
        }

        const relativePath = decodeURIComponent(localUrl.replace(/^\/pic_db\//, ''));
        const sourcePath = await resolvePicDbPath(relativePath);
        if (!sourcePath.startsWith(picDbDir) || !fs.existsSync(sourcePath) || fs.statSync(sourcePath).isDirectory()) {
          respondJson(res, 200, { localUrl });
          return;
        }

        const extension = path.extname(sourcePath) || '.png';
        const targetDirectory = path.join(picDbDir, targetBookFolder, category, subcategory);
        const targetFileName = `${fileStem}${extension}`;
        const targetPath = path.join(targetDirectory, targetFileName);

        await fsp.mkdir(targetDirectory, { recursive: true });

        const siblingFiles = await fsp.readdir(targetDirectory).catch(() => []);
        await Promise.all(
          siblingFiles
            .filter((name) => isStemMatch(name, fileStem) && name !== targetFileName)
            .map(async (name) => {
              try {
                await fsp.unlink(path.join(targetDirectory, name));
              } catch {
                // Best-effort cleanup.
              }
            })
        );

        if (sourcePath !== targetPath) {
          try {
            await fsp.unlink(targetPath);
          } catch (error) {
            if (error.code !== 'ENOENT') {
              throw error;
            }
          }

          await fsp.rename(sourcePath, targetPath);
          await removeEmptyDirectories(path.dirname(sourcePath), picDbDir);
        }

        respondJson(res, 200, {
          localUrl: `/pic_db/${[targetBookFolder, category, subcategory, targetFileName].map(encodeURIComponent).join('/')}`,
        });
        return;
      }

      if (pathname === '/api/relocate-generated-image' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const localUrl = String(body.localUrl || '');
        const targetBookFolder = sanitizeSegment(body.targetBookFolder || '');

        if (!localUrl.startsWith('/pic_db/')) {
          respondJson(res, 400, { error: 'localUrl must start with /pic_db/' });
          return;
        }

        if (!targetBookFolder) {
          respondJson(res, 400, { error: 'targetBookFolder is required' });
          return;
        }

        const relativePath = decodeURIComponent(localUrl.replace(/^\/pic_db\//, ''));
        const pathSegments = relativePath.split('/').filter(Boolean);
        if (pathSegments.length < 4) {
          respondJson(res, 400, { error: 'localUrl format is invalid' });
          return;
        }

        const [, ...restSegments] = pathSegments;
        const nextRelativePath = [targetBookFolder, ...restSegments];
        const sourcePath = path.resolve(picDbDir, relativePath);
        const targetPath = path.resolve(picDbDir, ...nextRelativePath);

        if (!sourcePath.startsWith(picDbDir) || !targetPath.startsWith(picDbDir)) {
          respondJson(res, 400, { error: 'Invalid path' });
          return;
        }

        if (sourcePath !== targetPath) {
          await fsp.mkdir(path.dirname(targetPath), { recursive: true });

          try {
            await fsp.unlink(targetPath);
          } catch (error) {
            if (error.code !== 'ENOENT') {
              throw error;
            }
          }

          try {
            const stats = await fsp.stat(sourcePath);
            if (stats.isFile()) {
              await fsp.rename(sourcePath, targetPath);
              await removeEmptyDirectories(path.dirname(sourcePath), picDbDir);
            }
          } catch (error) {
            if (error.code !== 'ENOENT') {
              throw error;
            }
          }
        }

        respondJson(res, 200, {
          localUrl: `/pic_db/${nextRelativePath.map(encodeURIComponent).join('/')}`,
        });
        return;
      }

      if (pathname === '/api/bootstrap-local-library' && req.method === 'GET') {
        const txtFiles = await fsp.readdir(baseDir).catch(() => []);
        const txtBooks = await Promise.all(
          txtFiles
            .filter((name) => name.endsWith('.txt'))
            .map(async (name) => {
              const filePath = path.join(baseDir, name);
              try {
                const content = await fsp.readFile(filePath, 'utf-8');
                return {
                  title: path.basename(name, '.txt'),
                  content,
                };
              } catch {
                return null;
              }
            })
        );

        const bookFolders = await fsp.readdir(picDbDir).catch(() => []);
        const books = await Promise.all(
          bookFolders.map(async (bookFolder) => {
            const readNamedImages = async (category, subcategory) => {
              const dir = path.join(picDbDir, bookFolder, category, subcategory);
              const exists = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
              if (!exists) return [];

              const entries = await fsp.readdir(dir);
              return entries
                .filter((name) => /\.(png|jpe?g|webp|gif)$/i.test(name))
                .map((name) => ({
                  name: path.basename(name, path.extname(name)),
                  localUrl: `/pic_db/${[bookFolder, category, subcategory, name].map(encodeURIComponent).join('/')}`,
                }));
            };

            const readIllustrations = async () => {
              const dir = path.join(picDbDir, bookFolder, 'illustrations', 'paragraphs');
              const exists = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
              if (!exists) return [];

              const entries = await fsp.readdir(dir);
              return entries
                .filter((name) => /\.(png|jpe?g|webp|gif)$/i.test(name))
                .map((name) => ({
                  fileStem: path.basename(name, path.extname(name)),
                  localUrl: `/pic_db/${[bookFolder, 'illustrations', 'paragraphs', name].map(encodeURIComponent).join('/')}`,
                }));
            };

            const coverDir = path.join(picDbDir, bookFolder, 'covers', 'books');
            let coverUrl = null;
            if (fs.existsSync(coverDir) && fs.statSync(coverDir).isDirectory()) {
              const coverEntries = await fsp.readdir(coverDir);
              const coverName = coverEntries.find((name) => /\.(png|jpe?g|webp|gif)$/i.test(name));
              if (coverName) {
                coverUrl = `/pic_db/${[bookFolder, 'covers', 'books', coverName].map(encodeURIComponent).join('/')}`;
              }
            }

            return {
              bookFolder,
              coverUrl,
              characters: await readNamedImages('assets', 'characters'),
              locations: await readNamedImages('assets', 'locations'),
              illustrations: await readIllustrations(),
            };
          })
        );

        respondJson(res, 200, {
          txtBooks: txtBooks.filter(Boolean),
          books,
        });
        return;
      }

      if (pathname === '/api/save-app-snapshot' && req.method === 'POST') {
        const body = await readJsonBody(req);
        await fsp.writeFile(
          snapshotPath,
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              snapshot: body.snapshot ?? null,
            },
            null,
            2
          ),
          'utf-8'
        );
        res.statusCode = 204;
        res.end();
        return;
      }

      if (pathname === '/api/load-app-snapshot' && req.method === 'GET') {
        if (!fs.existsSync(snapshotPath)) {
          respondJson(res, 200, { snapshot: null });
          return;
        }

        const content = await fsp.readFile(snapshotPath, 'utf-8');
        const parsed = JSON.parse(content);
        respondJson(res, 200, {
          snapshot: parsed.snapshot ?? null,
          exportedAt: parsed.exportedAt ?? null,
        });
        return;
      }

      const normalizedPath = pathname === '/' ? '/index.html' : pathname;
      const targetPath = path.resolve(distDir, `.${normalizedPath}`);
      if (targetPath.startsWith(distDir) && fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
        res.setHeader('Content-Type', getMimeType(targetPath));
        fs.createReadStream(targetPath).pipe(res);
        return;
      }

      const indexPath = path.join(distDir, 'index.html');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      fs.createReadStream(indexPath).pipe(res);
    } catch (error) {
      res.statusCode = 500;
      res.end(error?.message || 'Internal server error');
    }
  });

  return server;
};

module.exports = {
  createServer,
};
