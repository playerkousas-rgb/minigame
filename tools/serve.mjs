#!/usr/bin/env node
/*
 * tools/serve.mjs — 零依賴本機靜態伺服器（給 npm start 用）
 *
 * `npx serve` 每次都要上網下載套件，離線開發時直接開不到；
 * 這支只用 Node 內建模組，支援 Service Worker（需要 http:// 而非 file://）、
 * 正確 MIME、防止路徑穿越，以及把 /room 之類的乾淨網址 fallback 到 index.html。
 *
 * 用法：
 *   node tools/serve.mjs            # http://0.0.0.0:4173
 *   PORT=8080 node tools/serve.mjs
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(url.pathname);

  // Vercel Analytics 的 snippet 在本機不存在：回 204，避免主控台一堆 404。
  if (pathname.startsWith('/_vercel/')) {
    response.writeHead(204).end();
    return;
  }

  let filePath = path.join(ROOT, pathname);
  // 阻擋 path traversal（例如 /../../etc/passwd）
  const relative = path.relative(ROOT, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    // cleanUrls：沒有副檔名的路徑（例如 /room）交回 index.html；
    // 但 /icons/missing.png 這種就直接 404，免得壞圖靜靜變成 HTML。
    if (path.extname(pathname)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    filePath = path.join(ROOT, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    // 開發時永遠拿最新檔，順便避開 Service Worker 舊快取。
    'Cache-Control': 'no-store',
    'Service-Worker-Allowed': '/',
  });
  if (request.method === 'HEAD') { response.end(); return; }
  createReadStream(filePath).pipe(response);
});

server.listen(PORT, HOST, () => {
  console.log(`出門玩 · Pocket Play → http://${HOST}:${PORT}`);
  console.log('（按 Ctrl+C 停止）');
});
