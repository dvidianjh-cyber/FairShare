// Last Modified: 2026-05-20T21:11:10Z
import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

const PORT = 3000;
const PUBLIC_DIR = process.cwd();

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // --- API Routing ---
  if (pathname.startsWith('/api/')) {
    const apiName = pathname.replace('/api/', '');
    const apiFilePath = path.join(PUBLIC_DIR, 'api', `${apiName}.js`);

    if (!fs.existsSync(apiFilePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `API endpoint ${pathname} not found.` }));
    }

    // Read and parse JSON body if present
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid JSON request body.' }));
      }

      // Add Vercel-like response helpers
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.writeHead(res.statusCode || 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return res;
      };
      res.send = (data) => {
        res.writeHead(res.statusCode || 200);
        res.end(data);
        return res;
      };

      try {
        // Dynamically import the handler (add a cache-busting query to ease local dev reloading)
        const modulePath = `./api/${apiName}.js?t=${Date.now()}`;
        const { default: handler } = await import(modulePath);
        await handler(req, res);
      } catch (error) {
        console.error(`Error in API endpoint ${pathname}:`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error in API handler.' }));
      }
    });
    return;
  }

  // --- Static File Routing ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Prevent directory traversal attacks
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If static file not found, fall back to index.html (useful for SPA routing)
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`FairShare Dev Server running at:`);
  console.log(`http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
