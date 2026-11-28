const CACHE_NAME = 'nucraft-v192';
const ASSETS = [
  './',
  './index.html',
  './NUCRAFT.html',
  './css/hud.css',
  './css/menus.css',
  './shared/constants.js',
  './shared/blocks.js',
  './src/config.js',
  './src/world/chunkWorker.js',
  './assets/nucraft_app.min.js',
  './assets/nucraft_core.wasm?v=192',
  './assets/three.min.js',
  './assets/player_skins_bundle.js',
  './assets/mc_icons_bundle.js',
  './assets/nucraft_logo.png',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const p = url.pathname;
  if (p.indexOf('/__nucraft_') === 0) return;
  const isImmutableBinary =
    p.includes('/assets/models/') ||
    p.includes('/assets/luanti_sounds/') ||
    p.includes('/skin/') ||
    /\.(glb|ogg|mp3|png|webp|svg|woff2?)$/i.test(p);

  if (isImmutableBinary) {
    e.respondWith(
      caches.match(e.request, { cacheName: CACHE_NAME }).then((hit) => hit || fetch(e.request, { cache: 'no-cache' }).then((res) => {
        if (res && res.ok) {
          const cp = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, cp)).catch(() => {});
        }
        return res;
      }))
    );
    return;
  }
  // Network-first with ETag revalidation for HTML/CSS/JS so updates load immediately on clean canonical URL
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res && res.ok) {
        const cp = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, cp)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(e.request, { cacheName: CACHE_NAME }))
  );
});
