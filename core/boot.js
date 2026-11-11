/* core/boot.js · Arranque: modo sin internet y restauración de sesión */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker no registrado:', err));
  }
  const saved = Number(sessionStorage.getItem('gemaUser'));
  const u = saved && Store.users.byId(saved);
  if (u && u.active) App.start(u); else App.signOut();
})();
