const CACHE_NAME = 'protector-v13';
const LIB_CACHE = 'protector-libs-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(ASSETS.map((a) => cache.add(a).catch(() => null))))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== LIB_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isVersionedLib(url) {
  return url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (isVersionedLib(url)) {
    e.respondWith(
      caches.open(LIB_CACHE).then((c) => c.match(e.request).then((hit) => {
        if (hit) return hit;
        return fetch(e.request).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) e.waitUntil(c.put(e.request, res.clone()));
          return res;
        });
      }))
    );
