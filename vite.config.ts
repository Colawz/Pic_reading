import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const PIC_DB_DIR = path.resolve(__dirname, 'pic_db');

const getMimeType = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
};

const sanitizeSegment = (value: string) => value.replace(/[^a-zA-Z0-9-_]/g, '_');

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

const attachLocalImageMiddlewares = (middlewares: any) => {
  middlewares.use('/pic_db', async (req: any, res: any, next: any) => {
    const requestPath = decodeURIComponent((req.url || '').split('?')[0]);
    const relativePath = requestPath.replace(/^\/+/, '');
    const filePath = path.resolve(PIC_DB_DIR, relativePath);

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
      const fileName = `${fileStem}-${Date.now()}.${extension}`;
      const filePath = path.join(directory, fileName);
      const arrayBuffer = await upstreamResponse.arrayBuffer();
      await fsp.writeFile(filePath, Buffer.from(arrayBuffer));

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
