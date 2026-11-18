/* modulos/caja/caja.js · Pantalla de caja (apertura y cierre)
   Reglas de negocio: modulos/caja/caja.datos.js */
(function () {
  'use strict';
  const { $, moneda, redondear, fechaHora, esc, aviso, abrirVentana, pedirConfirmacion } = App;

  App.registrar({ id: 'caja', orden: 3, icono: '💵', etiqueta: 'Corte de caja', roles: ['Administrador', 'Cajero'], mostrar });

  const claseDif = d => d === 0 ? 'cuadra' : d < 0 ? 'faltante' : 'sobrante';

  function mostrar(vista) {
    const s = Almacen.caja.actual();
    let html = `<div class="heading"><div><h1>💵 Corte y conciliación de caja</h1><div class="muted">Apertura con cambio inicial y corte al cierre.</div></div></div>`;
    if (!s) {
      const ultima = Almacen.caja.historial()[0];
      html += `<div class="card" style="max-width:560px"><h2>Abrir caja</h2>
        <p class="muted" style="margin-top:0">Registra el dinero que se deja al cajero como cambio inicial.</p>
        <label class="muted" for="fondoInicial">Cambio inicial ($)</label>
        <input id="fondoInicial" type="number" inputmode="decimal" min="0" step=".01" value="${ultima ? ultima.fondoInicial : 500}" class="big" style="width:100%;margin:6px 0 4px">
        <button class="primary xl" id="btnAbrir">Abrir caja</button></div>`;
    } else {
      const t = Almacen.caja.totales(s);
      html += `<div class="note" style="margin-bottom:14px">Caja abierta por <b>${esc(s.abiertaPor)}</b> el ${fechaHora(s.abiertaEn)}.</div>
        <div class="cards4">
          <div class="card"><div class="metriclabel">Cambio inicial</div><div class="metric">${moneda(s.fondoInicial)}</div></div>
          <div class="card"><div class="metriclabel">Ventas en efectivo</div><div class="metric">${moneda(t.efectivo)}</div></div>
          <div class="card"><div class="metriclabel">Efectivo esperado</div><div class="metric">${moneda(t.esperado)}</div></div>
          <div class="card"><div class="metriclabel">Tarjeta + transferencia (no entran al cajón)</div><div class="metric">${moneda(t.tarjeta + t.transferencia)}</div>
            <div class="muted">Tarjeta ${moneda(t.tarjeta)} · Transferencia ${moneda(t.transferencia)}</div></div>
        </div>
        <div class="card" style="max-width:640px"><h2>Cerrar caja</h2>
          <div class="formgrid">
            <label class="wide">Efectivo contado físicamente ($)<input id="efectivoContado" type="number" inputmode="decimal" min="0" step=".01" class="big" placeholder="Cuenta el dinero y escríbelo aquí"></label>
            <label class="wide">Observaciones (opcional)<textarea id="notasCierre" rows="2"></textarea></label>
          </div>
          <div class="summaryline big" style="margin-top:8px"><span>Diferencia</span><span id="valorDif" class="diferencia">—</span></div>
          <div class="muted" id="textoDif"></div>
          <button class="primary xl" id="btnCerrar">Cerrar caja y guardar corte</button>
        </div>`;
    }
    vista.innerHTML = html;
    vista.onclick = alHacerClic;
    vista.oninput = e => { if (e.target.id === 'efectivoContado') actualizarDiferencia(); };
  }

  function actualizarDiferencia() {
    const s = Almacen.caja.actual(), crudo = $('efectivoContado').value, valor = $('valorDif'), texto = $('textoDif');
    if (crudo === '') { valor.textContent = '—'; valor.className = 'diferencia'; texto.textContent = ''; return; }
    const dif = redondear(Number(crudo) - Almacen.caja.totales(s).esperado);
    valor.textContent = moneda(dif);
    valor.className = 'diferencia ' + claseDif(dif);
    texto.textContent = dif === 0 ? 'La caja cuadra.' : dif < 0 ? `Faltante de ${moneda(-dif)}` : `Sobrante de ${moneda(dif)}`;
  }

  async function alHacerClic(e) {
    if (e.target.closest('#btnAbrir')) {
      try { Almacen.caja.abrir($('fondoInicial').value, App.usuario.nombre); aviso('Caja abierta.'); App.actualizarEstado(); mostrar($('vista')); }
      catch (err) { aviso(err.message, true); }
    } else if (e.target.closest('#btnCerrar')) {
      if ($('efectivoContado').value === '') { aviso('Escribe el efectivo contado.', true); return; }
      if (!(await pedirConfirmacion('Cerrar caja', 'Al cerrar la caja ya no se podrán registrar ventas hasta abrirla de nuevo. ¿Continuar?', 'Sí, cerrar'))) return;
      try {
        const s = Almacen.caja.cerrar($('efectivoContado').value, $('notasCierre').value, App.usuario.nombre);
        abrirVentana('Corte guardado', `
          <div class="summaryline"><span>Cambio inicial</span><b>${moneda(s.fondoInicial)}</b></div>
          <div class="summaryline"><span>Ventas en efectivo</span><b>${moneda(s.ventasEfectivo)}</b></div>
          <div class="summaryline"><span>Efectivo esperado</span><b>${moneda(s.efectivoEsperado)}</b></div>
          <div class="summaryline"><span>Efectivo contado</span><b>${moneda(s.efectivoContado)}</b></div>
          <div class="summaryline"><span>Tarjeta / Transferencia</span><b>${moneda(s.ventasTarjeta)} / ${moneda(s.ventasTransferencia)}</b></div>
          <div class="summaryline big"><span>${s.diferencia === 0 ? 'La caja cuadra' : s.diferencia < 0 ? 'Faltante' : 'Sobrante'}</span><span class="diferencia ${claseDif(s.diferencia)}">${s.diferencia === 0 ? '' : moneda(s.diferencia)}</span></div>`,
          [{ texto: 'Listo', clase: 'primary' }]);
        App.actualizarEstado(); mostrar($('vista'));
      } catch (err) { aviso(err.message, true); }
    }
  }
})();
