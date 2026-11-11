/* Service Worker: permite abrir el sistema sin internet (después de la primera carga).
   Primero intenta la red (para recibir actualizaciones); si falla usa la copia guardada. */
const CACHE = 'gema-pos-v2';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './css/base.css', './core/store.js', './core/app.js', './core/boot.js',
  './modules/auth/auth.css', './modules/auth/auth.js',
  './modules/sales/sales.css', './modules/sales/sales.js', './modules/sales/sales.data.js',
  './modules/inventory/inventory.js', './modules/inventory/inventory.data.js',
  './modules/cash/cash.css', './modules/cash/cash.js', './modules/cash/cash.data.js',
  './modules/reports/reports.js',
  './modules/users/users.js', './modules/users/users.data.js',
  './modules/settings/settings.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return; // Firebase y otros servicios no se tocan
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
