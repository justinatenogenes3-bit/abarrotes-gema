/* modules/cash/cash.js · Pantalla de caja (apertura y cierre)
   Reglas de negocio: modules/cash/cash.data.js */
(function () {
  'use strict';
  const { $, money, r2, fdate, esc, toast, openModal, askConfirm } = App;

  App.register({ id: 'cash', order: 3, icon: '💵', label: 'Corte de caja', roles: ['Administrador', 'Cajero'], render });

  function render(view) {
    const s = Store.cash.current();
    let html = `<div class="heading"><div><h1>💵 Corte y conciliación de caja</h1><div class="muted">Apertura con cambio inicial y corte al cierre.</div></div></div>`;
    if (!s) {
      const last = Store.cash.history()[0];
      html += `<div class="card" style="max-width:560px"><h2>Abrir caja</h2>
        <p class="muted" style="margin-top:0">Registra el dinero que se deja al cajero como cambio inicial.</p>
        <label class="muted" for="openCash">Cambio inicial ($)</label>
        <input id="openCash" type="number" inputmode="decimal" min="0" step=".01" value="${last ? last.openingCash : 500}" class="big" style="width:100%;margin:6px 0 4px">
        <button class="primary xl" id="openBtn">Abrir caja</button></div>`;
    } else {
      const t = Store.cash.totals(s);
      html += `<div class="note" style="margin-bottom:14px">Caja abierta por <b>${esc(s.openedBy)}</b> el ${fdate(s.openedAt)}.</div>
        <div class="cards4">
          <div class="card"><div class="metriclabel">Cambio inicial</div><div class="metric">${money(s.openingCash)}</div></div>
          <div class="card"><div class="metriclabel">Ventas en efectivo</div><div class="metric">${money(t.cash)}</div></div>
          <div class="card"><div class="metriclabel">Efectivo esperado</div><div class="metric">${money(t.expected)}</div></div>
          <div class="card"><div class="metriclabel">Tarjeta + transferencia (no entran al cajón)</div><div class="metric">${money(t.card + t.transfer)}</div>
            <div class="muted">Tarjeta ${money(t.card)} · Transferencia ${money(t.transfer)}</div></div>
        </div>
        <div class="card" style="max-width:640px"><h2>Cerrar caja</h2>
          <div class="formgrid">
            <label class="wide">Efectivo contado físicamente ($)<input id="counted" type="number" inputmode="decimal" min="0" step=".01" class="big" placeholder="Cuenta el dinero y escríbelo aquí"></label>
            <label class="wide">Observaciones (opcional)<textarea id="closeNotes" rows="2"></textarea></label>
          </div>
          <div class="summaryline big" style="margin-top:8px"><span>Diferencia</span><span id="diffVal" class="diff">—</span></div>
          <div class="muted" id="diffText"></div>
          <button class="primary xl" id="closeBtn">Cerrar caja y guardar corte</button>
        </div>`;
    }
    view.innerHTML = html;
    view.onclick = onClick;
    view.oninput = e => { if (e.target.id === 'counted') updateDiff(); };
  }

  function updateDiff() {
    const s = Store.cash.current(), raw = $('counted').value, el = $('diffVal'), tx = $('diffText');
    if (raw === '') { el.textContent = '—'; el.className = 'diff'; tx.textContent = ''; return; }
    const diff = r2(Number(raw) - Store.cash.totals(s).expected);
    el.textContent = money(diff);
    el.className = 'diff ' + (diff === 0 ? 'ok' : diff < 0 ? 'neg' : 'pos');
    tx.textContent = diff === 0 ? 'La caja cuadra.' : diff < 0 ? `Faltante de ${money(-diff)}` : `Sobrante de ${money(diff)}`;
  }

  async function onClick(e) {
    if (e.target.closest('#openBtn')) {
      try { Store.cash.open($('openCash').value, App.user.name); toast('Caja abierta.'); App.refreshStatus(); render($('view')); }
      catch (err) { toast(err.message, true); }
    } else if (e.target.closest('#closeBtn')) {
      if ($('counted').value === '') { toast('Escribe el efectivo contado.', true); return; }
      if (!(await askConfirm('Cerrar caja', 'Al cerrar la caja ya no se podrán registrar ventas hasta abrirla de nuevo. ¿Continuar?', 'Sí, cerrar'))) return;
      try {
        const s = Store.cash.close($('counted').value, $('closeNotes').value, App.user.name);
        const cls = s.diff === 0 ? 'ok' : s.diff < 0 ? 'neg' : 'pos';
        openModal('Corte guardado', `
          <div class="summaryline"><span>Cambio inicial</span><b>${money(s.openingCash)}</b></div>
          <div class="summaryline"><span>Ventas en efectivo</span><b>${money(s.cashSales)}</b></div>
          <div class="summaryline"><span>Efectivo esperado</span><b>${money(s.expectedCash)}</b></div>
          <div class="summaryline"><span>Efectivo contado</span><b>${money(s.countedCash)}</b></div>
          <div class="summaryline"><span>Tarjeta / Transferencia</span><b>${money(s.cardSales)} / ${money(s.transferSales)}</b></div>
          <div class="summaryline big"><span>${s.diff === 0 ? 'La caja cuadra' : s.diff < 0 ? 'Faltante' : 'Sobrante'}</span><span class="diff ${cls}">${s.diff === 0 ? '' : money(s.diff)}</span></div>`,
          [{ label: 'Listo', cls: 'primary' }]);
        App.refreshStatus(); render($('view'));
      } catch (err) { toast(err.message, true); }
    }
  }
})();
