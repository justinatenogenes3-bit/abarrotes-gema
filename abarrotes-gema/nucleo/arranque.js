/* nucleo/arranque.js · Arranque: modo sin internet y restauración de sesión */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker no registrado:', err));
  }
  const guardado = Number(sessionStorage.getItem('gemaUsuario'));
  const u = guardado && Almacen.usuarios.porId(guardado);
  if (u && u.activo) App.iniciar(u); else App.cerrarSesion();
})();
