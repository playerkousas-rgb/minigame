/*
 * 出門玩 · Pocket Play — Service Worker
 * 目標：離線可玩，但永遠唔會「卡住舊版」或者「快取錯嘢」。
 *
 * 規則（tools/verify.mjs 會檢查）：
 *  1. 只處理同源（same-origin）GET；PeerJS 的 WebSocket／跨域請求一律交返瀏覽器。
 *  2. 導覽請求（HTML）用 network-first：一上線就拿到最新版，斷網才回快取。
 *  3. 靜態資源（CSS/JS/圖示）用 stale-while-revalidate：即刻回應、背景更新。
 *  4. 只快取 200 OK 的基本回應；唔會把 404／500／opaque 回應寫入快取。
 *  5. 版本號 = APP_VERSION；每次改版一齊改 package.json／index.html／app.js，舊快取自動清走。
 */
const APP_VERSION = '1.1.0';
const CACHE_NAME = `pocket-play-v${APP_VERSION}`;
const OFFLINE_URL = './index.html';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './vendor/qrcode.js',
  './vendor/peerjs.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache: 'reload' 強制跳過 HTTP 快取，確保新版本外殼真的落袋。
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isCacheable(response) {
  return response && response.ok && response.type === 'basic';
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('離線中，請重新連線後再試。', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (isCacheable(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) {
    network.catch(() => {});
    return cached;
  }
  const response = await network;
  if (response) return response;
  return new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 跨域（PeerJS 信令、STUN 等）與 Vercel 內部端點一律不經 SW。
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_vercel/')) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
