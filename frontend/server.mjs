import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND_DIR = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.FRONTEND_PORT || 3000);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rawPath = normalize(url.pathname);
  const safePath = normalize(url.pathname === '/' || !extname(rawPath)
    ? '/index.html'
    : url.pathname);

  if (safePath.includes('..')) {
    res.statusCode = 403;
    res.end('forbidden');
    return;
  }

  try {
    const filePath = join(FRONTEND_DIR, safePath);
    const file = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader('content-type', types[extname(filePath)] || 'application/octet-stream');
    res.end(file);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`[VAbs frontend] http://localhost:${port}`);
});
