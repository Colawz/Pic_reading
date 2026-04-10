import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const PIC_DB_DIR = path.resolve(__dirname, 'pic_db');
const APP_SNAPSHOT_PATH = path.resolve(__dirname, 'app_state_snapshot.json');

const getMimeType = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
};

const sanitizeSegment = (value: string) => {
  const sanitized = value
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized || 'untitled';
};

const removeEmptyDirectories = async (directory: string) => {
  if (directory === PIC_DB_DIR || !directory.startsWith(PIC_DB_DIR)) {
    return;
  }

  try {
    const entries = await fsp.readdir(directory);
    if (entries.length > 0) {
      return;
    }

    await fsp.rmdir(directory);
    await removeEmptyDirectories(path.dirname(directory));
  } catch {
    // Ignore cleanup failures so file deletion remains best-effort.
  }
};

const resolvePicDbPath = async (relativePath: string) => {
  const primaryPath = path.resolve(PIC_DB_DIR, relativePath);
  if (primaryPath.startsWith(PIC_DB_DIR) && fs.existsSync(primaryPath) && fs.statSync(primaryPath).isFile()) {
    return primaryPath;
  }

  const pathSegments = relativePath.split('/').filter(Boolean);
  if (pathSegments.length < 2) {
    return primaryPath;
  }

  const fallbackRelativeSuffix = pathSegments.slice(1);

  try {
    const bookFolders = await fsp.readdir(PIC_DB_DIR);
    for (const bookFolder of bookFolders) {
      const fallbackPath = path.resolve(PIC_DB_DIR, bookFolder, ...fallbackRelativeSuffix);
      if (fallbackPath.startsWith(PIC_DB_DIR) && fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
        return fallbackPath;
      }
    }
  } catch {
    // Ignore fallback lookup failures and let the original path miss.
  }

  return primaryPath;
};

const isStemMatch = (name: string, fileStem: string) => {
  const ext = path.extname(name);
  const baseName = path.basename(name, ext);
  return baseName === fileStem || baseName.startsWith(`${fileStem}-`);
};

const attachLocalImageMiddlewares = (middlewares: any) => {
  middlewares.use('/pic_db', async (req: any, res: any, next: any) => {
    const requestPath = decodeURIComponent((req.url || '').split('?')[0]);
    const relativePath = requestPath.replace(/^\/+/, '');
    const filePath = await resolvePicDbPath(relativePath);

    if (!filePath.startsWith(PIC_DB_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      next();
      return;
    }

    res.setHeader('Content-Type', getMimeType(filePath));
    fs.createReadStream(filePath).pipe(res);
  });

  middlewares.use('/api/save-generated-image', async (req: any, res: any, next: any) => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      const remoteUrl = String(body.remoteUrl || '');
      const bookId = sanitizeSegment(String(body.bookId || 'unknown-book'));
      const category = sanitizeSegment(String(body.category || 'misc'));
      const subcategory = sanitizeSegment(String(body.subcategory || 'misc'));
      const fileStem = sanitizeSegment(String(body.fileStem || `image-${Date.now()}`));

      if (!remoteUrl) {
        res.statusCode = 400;
        res.end('remoteUrl is required');
        return;
      }

      const upstreamResponse = await fetch(remoteUrl);
      if (!upstreamResponse.ok) {
        res.statusCode = 502;
        res.end(`Failed to download remote image: ${upstreamResponse.status}`);
        return;
      }

      const contentType = upstreamResponse.headers.get('content-type') || '';
      const extension =
        contentType.includes('png') ? 'png' :
        contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' :
        contentType.includes('webp') ? 'webp' :
        contentType.includes('gif') ? 'gif' :
        path.extname(new URL(remoteUrl).pathname).replace('.', '') || 'png';

      const directory = path.join(PIC_DB_DIR, bookId, category, subcategory);
      await fsp.mkdir(directory, { recursive: true });
      const fileName = `${fileStem}.${extension}`;
      const filePath = path.join(directory, fileName);
      const arrayBuffer = await upstreamResponse.arrayBuffer();
      await fsp.writeFile(filePath, Buffer.from(arrayBuffer));

      // Keep only the normalized file for the same entity/paragraph.
      const siblingFiles = await fsp.readdir(directory);
      await Promise.all(
        siblingFiles
          .filter((name) => name !== fileName && isStemMatch(name, fileStem))
          .map(async (name) => {
            const siblingPath = path.join(directory, name);
            try {
              const stats = await fsp.stat(siblingPath);
              if (stats.isFile()) {
                await fsp.unlink(siblingPath);
              }
            } catch {
              // Best-effort cleanup only.
            }
          })
      );

      const localUrl = `/pic_db/${[bookId, category, subcategory, fileName].map(encodeURIComponent).join('/')}`;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ localUrl }));
    } catch (error: any) {
      res.statusCode = 500;
      res.end(error?.message || 'Failed to save generated image');
    }
  });

  middlewares.use('/api/delete-generated-image', async (req: any, res: any, next: any) => {
    if (req.method !== 'DELETE') {
      next();
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      const localUrl = String(body.localUrl || '');

      if (!localUrl.startsWith('/pic_db/')) {
        res.statusCode = 400;
        res.end('localUrl must start with /pic_db/');
        return;
      }

      const relativePath = decodeURIComponent(localUrl.replace(/^\/pic_db\//, ''));
      const filePath = path.resolve(PIC_DB_DIR, relativePath);

      if (!filePath.startsWith(PIC_DB_DIR)) {
        res.statusCode = 400;
        res.end('Invalid localUrl');
        return;
      }

      try {
        const stats = await fsp.stat(filePath);
        if (!stats.isDirectory()) {
          await fsp.unlink(filePath);
          await removeEmptyDirectories(path.dirname(filePath));
        }
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          throw error;
        }
      }

      res.statusCode = 204;
      res.end();
    } catch (error: any) {
      res.statusCode = 500;
      res.end(error?.message || 'Failed to delete generated image');
    }
  });

  middlewares.use('/api/check-generated-image', async (req: any, res: any, next: any) => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      const localUrl = String(body.localUrl || '');

      if (!localUrl.startsWith('/pic_db/')) {
        res.statusCode = 400;
        res.end('localUrl must start with /pic_db/');
        return;
      }

      const relativePath = decodeURIComponent(localUrl.replace(/^\/pic_db\//, ''));
      const filePath = path.resolve(PIC_DB_DIR, relativePath);
      const exists = filePath.startsWith(PIC_DB_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile();

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ exists }));
    } catch (error: any) {
      res.statusCode = 500;
      res.end(error?.message || 'Failed to check generated image');
    }
  });

  middlewares.use('/api/find-generated-image', async (req: any, res: any, next: any) => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      const bookFolder = sanitizeSegment(String(body.bookFolder || ''));
      const category = sanitizeSegment(String(body.category || 'misc'));
      const subcategory = sanitizeSegment(String(body.subcategory || 'misc'));
      const fileStem = sanitizeSegment(String(body.fileStem || ''));

      if (!bookFolder || !fileStem) {
        res.statusCode = 400;
        res.end('bookFolder and fileStem are required');
        return;
      }

      const directory = path.resolve(PIC_DB_DIR, bookFolder, category, subcategory);
      if (!directory.startsWith(PIC_DB_DIR) || !fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ localUrl: null }));
        return;
      }

      const entries = await fsp.readdir(directory);
      const matchedFile = entries
        .filter((name) => isStemMatch(name, fileStem))
        .sort((a, b) => Number(path.basename(a, path.extname(a)) === fileStem) - Number(path.basename(b, path.extname(b)) === fileStem))
        .at(-1);

      const localUrl = matchedFile
        ? `/pic_db/${[bookFolder, category, subcategory, matchedFile].map(encodeURIComponent).join('/')}`
        : null;

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ localUrl }));
    } catch (error: any) {
      res.statusCode = 500;
      res.end(error?.message || 'Failed to find generated image');
    }
  });

  middlewares.use('/api/normalize-generated-image', async (req: any, res: any, next: any) => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      const localUrl = String(body.localUrl || '');
      const targetBookFolder = sanitizeSegment(String(body.targetBookFolder || ''));
      const category = sanitizeSegment(String(body.category || 'misc'));
      const subcategory = sanitizeSegment(String(body.subcategory || 'misc'));
      const fileStem = sanitizeSegment(String(body.fileStem || 'image'));

      if (!localUrl.startsWith('/pic_db/')) {
        res.statusCode = 400;
        res.end('localUrl must start with /pic_db/');
        return;
      }

      const relativePath = decodeURIComponent(localUrl.replace(/^\/pic_db\//, ''));
      const sourcePath = await resolvePicDbPath(relativePath);
      if (!sourcePath.startsWith(PIC_DB_DIR) || !fs.existsSync(sourcePath) || fs.statSync(sourcePath).isDirectory()) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ localUrl }));
        return;
      }

      const extension = path.extname(sourcePath) || '.png';
      const targetDirectory = path.join(PIC_DB_DIR, targetBookFolder, category, subcategory);
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
        } catch (error: any) {
          if (error?.code !== 'ENOENT') {
            throw error;
          }
        }

        await fsp.rename(sourcePath, targetPath);
        await removeEmptyDirectories(path.dirname(sourcePath));
      }

      const nextLocalUrl = `/pic_db/${[targetBookFolder, category, subcategory, targetFileName].map(encodeURIComponent).join('/')}`;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ localUrl: nextLocalUrl }));
    } catch (error: any) {
      res.statusCode = 500;
      res.end(error?.message || 'Failed to normalize generated image');
    }
  });

  middlewares.use('/api/relocate-generated-image', async (req: any, res: any, next: any) => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      const localUrl = String(body.localUrl || '');
      const targetBookFolder = sanitizeSegment(String(body.targetBookFolder || ''));

      if (!localUrl.startsWith('/pic_db/')) {
        res.statusCode = 400;
        res.end('localUrl must start with /pic_db/');
        return;
      }

      if (!targetBookFolder) {
        res.statusCode = 400;
        res.end('targetBookFolder is required');
        return;
      }

      const relativePath = decodeURIComponent(localUrl.replace(/^\/pic_db\//, ''));
      const pathSegments = relativePath.split('/').filter(Boolean);

      if (pathSegments.length < 4) {
        res.statusCode = 400;
        res.end('localUrl format is invalid');
        return;
      }

      const [, ...restSegments] = pathSegments;
      const nextRelativePath = [targetBookFolder, ...restSegments];
      const sourcePath = path.resolve(PIC_DB_DIR, relativePath);
      const targetPath = path.resolve(PIC_DB_DIR, ...nextRelativePath);

      if (!sourcePath.startsWith(PIC_DB_DIR) || !targetPath.startsWith(PIC_DB_DIR)) {
        res.statusCode = 400;
        res.end('Invalid path');
        return;
      }

      if (sourcePath !== targetPath) {
        await fsp.mkdir(path.dirname(targetPath), { recursive: true });

        try {
          await fsp.unlink(targetPath);
        } catch (error: any) {
          if (error?.code !== 'ENOENT') {
            throw error;
          }
        }

        try {
          const stats = await fsp.stat(sourcePath);
          if (stats.isFile()) {
            await fsp.rename(sourcePath, targetPath);
            await removeEmptyDirectories(path.dirname(sourcePath));
          }
        } catch (error: any) {
          if (error?.code !== 'ENOENT') {
            throw error;
          }
        }
      }

      const nextLocalUrl = `/pic_db/${nextRelativePath.map(encodeURIComponent).join('/')}`;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ localUrl: nextLocalUrl }));
    } catch (error: any) {
      res.statusCode = 500;
      res.end(error?.message || 'Failed to relocate generated image');
    }
  });

  middlewares.use('/api/save-app-snapshot', async (req: any, res: any, next: any) => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      await fsp.writeFile(
        APP_SNAPSHOT_PATH,
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
    } catch (error: any) {
      res.statusCode = 500;
      res.end(error?.message || 'Failed to save app snapshot');
    }
  });

  middlewares.use('/api/load-app-snapshot', async (req: any, res: any, next: any) => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    try {
      if (!fs.existsSync(APP_SNAPSHOT_PATH)) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ snapshot: null }));
        return;
      }

      const content = await fsp.readFile(APP_SNAPSHOT_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ snapshot: parsed.snapshot ?? null, exportedAt: parsed.exportedAt ?? null }));
    } catch (error: any) {
      res.statusCode = 500;
      res.end(error?.message || 'Failed to load app snapshot');
    }
  });
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'local-image-storage',
          configureServer(server) {
            attachLocalImageMiddlewares(server.middlewares);
          },
          configurePreviewServer(server) {
            attachLocalImageMiddlewares(server.middlewares);
          }
        }
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
