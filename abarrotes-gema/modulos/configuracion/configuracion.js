/* modulos/configuracion/configuracion.js · Configuración, respaldos y estado (solo administrador) */
(function () {
  'use strict';
  const { $, fechaHora, aviso, pedirConfirmacion, descargar } = App;

  App.registrar({ id: 'configuracion', orden: 6, icono: '⚙️', etiqueta: 'Configuración', roles: ['Administrador'], mostrar });

  function mostrar(vista) {
    const ultimo = Almacen.bd.meta.ultimoRespaldo;
    vista.innerHTML = `
      <div class="heading"><div><h1>⚙️ Configuración</h1><div class="muted">Respaldos y estado del sistema.</div></div></div>
      <div class="cards2">
        <div class="card"><h2>Respaldo de la información</h2>
          <div class="note">Todo se guarda en <b>este navegador de este equipo</b>. Descarga un respaldo seguido (por ejemplo, al cerrar caja) y guárdalo en otro lugar. Último respaldo: <b>${ultimo ? fechaHora(ultimo) : 'nunca'}</b>.</div>
          <div class="row" style="margin-top:14px"><button class="primary" id="btnRespaldo">Descargar respaldo JSON</button><button id="btnRestaurar">Restaurar respaldo…</button></div>
          <input type="file" id="archivoRespaldo" accept="application/json,.json" class="oculto">
        </div>
        <div class="card"><h2>Estado del sistema</h2>
          <p><b>Conexión:</b> ${navigator.onLine ? 'En línea' : 'Sin conexión (modo local)'}</p>
          <p><b>Registros sin enviar a la nube:</b> ${Almacen.pendientes()}</p>
          <p><b>Almacenamiento:</b> local del navegador (Firebase se conecta en el Paso 2)</p>
          <p><b>Fuera de alcance:</b> cajón de dinero, app móvil, nómina, CFDI y báscula automática.</p>
          <button class="danger" id="btnBorrarTodo">Borrar todo y volver a datos de ejemplo</button>
        </div>
      </div>`;

    vista.onclick = async e => {
      if (e.target.closest('#btnRespaldo')) {
        descargar('respaldo_abarrotes_gema_' + new Date().toISOString().slice(0, 10) + '.json', Almacen.exportarJSON(), 'application/json');
        aviso('Respaldo descargado. Guárdalo en un lugar seguro.'); mostrar(vista);
      } else if (e.target.closest('#btnRestaurar')) {
        $('archivoRespaldo').click();
      } else if (e.target.closest('#btnBorrarTodo')) {
        if (await pedirConfirmacion('Borrar todo', 'Se borrarán ventas, caja, inventario y usuarios, y volverán los datos de ejemplo. Esta acción no se puede deshacer.', 'Sí, borrar todo', true)) {
          Almacen.restablecer(); App.cerrarSesion();
        }
      }
    };
    $('archivoRespaldo').onchange = e => {
      const archivo = e.target.files[0]; if (!archivo) return;
      const lector = new FileReader();
      lector.onload = async () => {
        try {
          const datos = JSON.parse(lector.result);
          if (!(await pedirConfirmacion('Restaurar respaldo', 'Se reemplazará TODA la información actual por la del archivo. ¿Continuar?', 'Sí, restaurar', true))) return;
          Almacen.importarDatos(datos); aviso('Respaldo restaurado.'); App.cerrarSesion();
        } catch (err) { aviso(err.message || 'No se pudo leer el archivo.', true); }
      };
      lector.readAsText(archivo);
    };
  }
})();
