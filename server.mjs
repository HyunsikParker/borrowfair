import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4', '.vtt': 'text/vtt' };
const port = Number(process.env.BORROWFAIR_PORT || 4193);
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !types[path.extname(file)] || /\/(test|submission)\//.test(file)) throw new Error('not found');
    const data = await fs.readFile(file);
    const headers = { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'" };
    const video = ['.mp4', '.webm'].includes(path.extname(file));
    if (video) headers['Accept-Ranges'] = 'bytes';
    if (video && req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      const start = match ? Number(match[1]) : NaN;
      const end = match && match[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= data.length) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${data.length}` }); res.end(); return;
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 });
      res.end(req.method === 'HEAD' ? undefined : data.subarray(start, end + 1)); return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': data.length }); res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`BorrowFair http://127.0.0.1:${port}`));
