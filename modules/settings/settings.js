/* modules/settings/settings.js · Configuración, respaldos y estado (solo administrador) */
(function () {
  'use strict';
  const { $, fdate, toast, askConfirm, download } = App;

  App.register({ id: 'settings', order: 6, icon: '⚙️', label: 'Configuración', roles: ['Administrador'], render });

  function render(view) {
    const last = Store.db.meta.lastBackup;
    view.innerHTML = `
      <div class="heading"><div><h1>⚙️ Configuración</h1><div class="muted">Respaldos y estado del sistema.</div></div></div>
      <div class="cards2">
        <div class="card"><h2>Respaldo de la información</h2>
          <div class="note">Todo se guarda en <b>este navegador de este equipo</b>. Descarga un respaldo seguido (por ejemplo, al cerrar caja) y guárdalo en otro lugar. Último respaldo: <b>${last ? fdate(last) : 'nunca'}</b>.</div>
          <div class="row" style="margin-top:14px"><button class="primary" id="backupBtn">Descargar respaldo JSON</button><button id="restoreBtn">Restaurar respaldo…</button></div>
          <input type="file" id="restoreFile" accept="application/json,.json" class="hidden">
        </div>
        <div class="card"><h2>Estado del sistema</h2>
          <p><b>Conexión:</b> ${navigator.onLine ? 'En línea' : 'Sin conexión (modo local)'}</p>
          <p><b>Registros sin enviar a la nube:</b> ${Store.pending()}</p>
          <p><b>Almacenamiento:</b> local del navegador (Firebase se conecta en el Paso 2)</p>
          <p><b>Fuera de alcance:</b> cajón de dinero, app móvil, nómina, CFDI y báscula automática.</p>
          <button class="danger" id="resetBtn">Borrar todo y volver a datos de ejemplo</button>
        </div>
      </div>`;

    view.onclick = async e => {
      if (e.target.closest('#backupBtn')) {
        download('respaldo_abarrotes_gema_' + new Date().toISOString().slice(0, 10) + '.json', Store.exportJSON(), 'application/json');
        toast('Respaldo descargado. Guárdalo en un lugar seguro.'); render(view);
      } else if (e.target.closest('#restoreBtn')) {
        $('restoreFile').click();
      } else if (e.target.closest('#resetBtn')) {
        if (await askConfirm('Borrar todo', 'Se borrarán ventas, caja, inventario y usuarios, y volverán los datos de ejemplo. Esta acción no se puede deshacer.', 'Sí, borrar todo', true)) {
          Store.reset(); App.signOut();
        }
      }
    };
    $('restoreFile').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const obj = JSON.parse(rd.result);
          if (!(await askConfirm('Restaurar respaldo', 'Se reemplazará TODA la información actual por la del archivo. ¿Continuar?', 'Sí, restaurar', true))) return;
          Store.importData(obj); toast('Respaldo restaurado.'); App.signOut();
        } catch (err) { toast(err.message || 'No se pudo leer el archivo.', true); }
      };
      rd.readAsText(f);
    };
  }
})();
