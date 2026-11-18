#!/usr/bin/env node
/*
 * tools/serve.mjs — 零依賴本機靜態伺服器（給 npm start 用）
 *
 * 版本化來源檔映射到同一組穩定 runtime URL（/index.html、/app.js 等），
 * 方便本機預覽同 Vercel public/ 建置產物保持一致。
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '0.0.0.0';
const APP_VERSION = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const RELEASE = `v${APP_VERSION}`;
const INDEX_SOURCE = `index_${RELEASE}.html`;
const SOURCE_BY_RUNTIME_PATH = new Map([
  ['/index.html', INDEX_SOURCE],
  ['/styles.css', `styles_${RELEASE}.css`],
  ['/app.js', `app_${RELEASE}.js`],
  ['/sw.js', `sw_${RELEASE}.js`],
  ['/manifest.webmanifest', `manifest_${RELEASE}.webmanifest`],
]);

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

  if (pathname === '/') pathname = '/index.html';
  pathname = SOURCE_BY_RUNTIME_PATH.get(pathname) ? `/${SOURCE_BY_RUNTIME_PATH.get(pathname)}` : pathname;

  let filePath = path.join(ROOT, pathname);
  // 阻擋 path traversal（例如 /../../etc/passwd）
  const relative = path.relative(ROOT, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, INDEX_SOURCE);
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    // cleanUrls：沒有副檔名的路徑（例如 /room）交回版本化首頁；
    // 但 /icons/missing.png 這種就直接 404，免得壞圖靜靜變成 HTML。
    if (path.extname(pathname)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    filePath = path.join(ROOT, INDEX_SOURCE);
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
