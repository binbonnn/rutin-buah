/* Server statis lokal untuk menjalankan PWA (node scripts/serve.js).
   X-03: URL dibaca dengan aman, traversal dicek per segmen, aset yang hilang
   dibalas 404, dan header keamanan dikirim bersama halaman. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon'
};

// X-02: samakan dengan meta CSP di index.html. Blob URL untuk ekspor tidak
// diblokir oleh default-src; unduhan memakai a.download + URL.createObjectURL.
const CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'"
].join('; ');

const HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
  'Cache-Control': 'no-cache',
  'Service-Worker-Allowed': '/'
};

// X-03: jangan menyajikan dokumentasi/internal scripts bila folder yang sama
// di-deploy ke hosting statis. sw.js & js/ tetap diperbolehkan.
const BLOCKED_PREFIXES = ['scripts/', '.git/', 'tests/'];

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  const headers = status === 200 ? HEADERS : { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  res.writeHead(status, { ...headers, 'Content-Type': type });
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) { send(res, 404, 'Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
}

http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch {
    send(res, 400, 'Bad request');
    return;
  }

  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, rel);
  const relCheck = path.relative(ROOT, filePath);
  // Separator-aware: '/a/routine-secret' tidak lagi lolos dari ROOT '/a/routine'.
  if (relCheck.startsWith('..' + path.sep) || relCheck === '..' || path.isAbsolute(relCheck)) {
    send(res, 403, 'Forbidden');
    return;
  }
  const normalized = rel.split('\\').join('/');
  if (BLOCKED_PREFIXES.some((p) => normalized.startsWith(p)) || /(^|\/)README\.md$/i.test(normalized)) {
    send(res, 404, 'Not found');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || stat.isDirectory() || !MIME[path.extname(filePath).toLowerCase()]) {
      // Fallback SPA hanya untuk rute tanpa ekstensi, bukan untuk aset yang hilang.
      if (!err && stat.isDirectory()) { send(res, 404, 'Not found'); return; }
      if (!path.extname(rel)) { serveFile(res, path.join(ROOT, 'index.html')); return; }
      send(res, 404, 'Not found');
      return;
    }
    serveFile(res, filePath);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Rutin & Buah berjalan di http://localhost:${PORT}`);
});
