/* Service Worker: permite abrir el sistema sin internet (después de la primera carga).
   Primero intenta la red (para recibir actualizaciones); si falla usa la copia guardada. */
const CACHE = 'gema-pos-v4';
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './estilos/base.css',
  './nucleo/almacen.js', './nucleo/app.js', './nucleo/arranque.js',
  './modulos/acceso/acceso.css', './modulos/acceso/acceso.js',
  './modulos/ventas/ventas.css', './modulos/ventas/ventas.js', './modulos/ventas/ventas.datos.js',
  './modulos/inventario/inventario.js', './modulos/inventario/inventario.datos.js',
  './modulos/caja/caja.css', './modulos/caja/caja.js', './modulos/caja/caja.datos.js',
  './modulos/reportes/reportes.js',
  './modulos/usuarios/usuarios.js', './modulos/usuarios/usuarios.datos.js',
  './modulos/configuracion/configuracion.js',
  './modulos/tiendas/tiendas.css', './modulos/tiendas/tiendas.js', './modulos/tiendas/tiendas.datos.js',
  './modulos/ticket/ticket.js', './modulos/ticket/ticket.datos.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return; // Firebase y otros servicios no se tocan
  e.respondWith(
    fetch(e.request)
      .then(res => { const copia = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
