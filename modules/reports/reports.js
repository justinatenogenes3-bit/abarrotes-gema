/* modules/reports/reports.js · Reportes (solo administrador)
   Solo lee los datos de los demás módulos; la única acción que modifica es cancelar una venta. */
(function () {
  'use strict';
  const { $, money, r2, qty, esc, fdate, isToday, toast, openModal, askConfirm, downloadCSV } = App;
  let period = 'today';

  App.register({ id: 'reports', order: 4, icon: '📊', label: 'Reportes', roles: ['Administrador'], render });

  const inPeriod = iso => period === 'all' ? true : period === 'today' ? isToday(iso) : Date.now() - new Date(iso).getTime() <= 7 * 864e5;
  const sub = s => s.subtotal ?? s.total;

  function render(view) {
    const sales = Store.sales.all().filter(s => inPeriod(s.at));
    const ok = sales.filter(s => s.status === 'ok');
    const sum = f => r2(ok.filter(f).reduce((a, s) => a + s.total, 0));
    const top = {};
    ok.forEach(s => s.items.forEach(i => { const t = top[i.id] || (top[i.id] = { name: i.name, unit: i.unit, qty: 0, amount: 0 }); t.qty += i.qty; t.amount += i.subtotal; }));
    const topList = Object.values(top).sort((a, b) => b.amount - a.amount).slice(0, 10);
    const moves = Store.db.movements.filter(m => inPeriod(m.at)).slice(0, 60);
    const cuts = Store.cash.history().filter(x => inPeriod(x.closedAt));
    const color = d => d === 0 ? 'var(--green)' : d < 0 ? 'var(--red)' : '#b57800';

    view.innerHTML = `
      <div class="heading"><div><h1>📊 Reportes</h1><div class="muted">Ventas, productos, inventario y cortes de caja.</div></div>
        <div class="row"><select id="period"><option value="today">Hoy</option><option value="week">Últimos 7 días</option><option value="all">Todo</option></select>
        <button id="exportBtn">Exportar ventas CSV</button></div></div>
      <div class="cards5">
        <div class="card"><div class="metriclabel">Ventas realizadas</div><div class="metric">${ok.length}</div></div>
        <div class="card"><div class="metriclabel">Ingresos totales</div><div class="metric">${money(sum(() => true))}</div></div>
        <div class="card"><div class="metriclabel">Efectivo</div><div class="metric">${money(sum(s => s.method === 'Efectivo'))}</div></div>
        <div class="card"><div class="metriclabel">Transferencia</div><div class="metric">${money(sum(s => s.method === 'Transferencia'))}</div></div>
        <div class="card"><div class="metriclabel">Tarjeta</div><div class="metric">${money(sum(s => s.method === 'Tarjeta'))}</div></div>
      </div>
      <div class="card"><h2>Ventas</h2><div class="tablewrap"><table><thead><tr><th>Folio</th><th>Fecha</th><th>Usuario</th><th>Pago</th><th>Total</th><th></th></tr></thead><tbody>
        ${sales.map(s => `<tr class="${s.status !== 'ok' ? 'cancelled' : ''}"><td>${s.folio}</td><td>${fdate(s.at)}</td><td>${esc(s.userName)}</td><td>${s.method}</td><td>${money(s.total)}</td><td><button class="sm" data-folio="${s.folio}">Ver</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No hay ventas en este periodo.</td></tr>'}
      </tbody></table></div></div>
      <div class="card" style="margin-top:14px"><h2>Productos más vendidos</h2><div class="tablewrap"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Importe</th></tr></thead><tbody>
        ${topList.map(t => `<tr><td>${esc(t.name)}</td><td>${qty(t.qty)} ${t.unit}</td><td>${money(t.amount)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sin datos.</td></tr>'}
      </tbody></table></div></div>
      <div class="card" style="margin-top:14px"><h2>Cortes de caja y diferencias</h2><div class="tablewrap"><table><thead><tr><th>Apertura</th><th>Cierre</th><th>Usuario</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Notas</th></tr></thead><tbody>
        ${cuts.map(x => `<tr><td>${fdate(x.openedAt)}</td><td>${fdate(x.closedAt)}</td><td>${esc(x.closedBy)}</td><td>${money(x.expectedCash)}</td><td>${money(x.countedCash)}</td><td><b style="color:${color(x.diff)}">${money(x.diff)}</b></td><td>${esc(x.notes)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No hay cortes en este periodo.</td></tr>'}
      </tbody></table></div></div>
      <div class="card" style="margin-top:14px"><h2>Movimientos de inventario</h2><div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Cantidad</th><th>Detalle</th><th>Usuario</th></tr></thead><tbody>
        ${moves.map(m => `<tr><td>${fdate(m.at)}</td><td>${m.type}</td><td>${esc(m.product)}</td><td>${m.qty > 0 ? '+' : ''}${qty(m.qty)} ${m.unit}</td><td>${esc(m.note)}</td><td>${esc(m.userName)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sin movimientos.</td></tr>'}
      </tbody></table></div></div>`;
    $('period').value = period;
    $('period').onchange = e => { period = e.target.value; render(view); };
    view.onclick = e => {
      if (e.target.closest('#exportBtn')) return downloadCSV('ventas_abarrotes_gema.csv',
        [['Folio', 'Fecha', 'Usuario', 'Pago', 'Estado', 'Subtotal', 'Descuento', 'Total'],
         ...Store.sales.all().map(s => [s.folio, fdate(s.at), s.userName, s.method, s.status === 'ok' ? 'Vigente' : 'Cancelada', sub(s), s.discount || 0, s.total])]);
      const b = e.target.closest('[data-folio]'); if (b) saleDetail(b.dataset.folio);
    };
  }

  function saleDetail(folio) {
    const s = Store.sales.byFolio(folio);
    const body = `<div class="muted">${fdate(s.at)} · ${esc(s.userName)} · ${s.method}${s.status !== 'ok' ? ' · <b style="color:var(--red)">CANCELADA</b>' : ''}</div>
      <div class="tablewrap"><table><thead><tr><th>Producto</th><th>Cant.</th><th>Importe</th></tr></thead><tbody>
      ${s.items.map(i => `<tr><td>${esc(i.name)}</td><td>${qty(i.qty)} ${i.unit}</td><td>${money(i.subtotal)}</td></tr>`).join('')}</tbody></table></div>
      ${s.discount ? `<div class="summaryline"><span>Subtotal</span><b>${money(sub(s))}</b></div><div class="summaryline"><span>Descuento</span><b>-${money(s.discount)}</b></div>` : ''}
      <div class="summaryline big"><span>Total</span><span>${money(s.total)}</span></div>`;
    const btns = [{ label: 'Cerrar' }];
    if (s.status === 'ok') btns.unshift({ label: 'Cancelar venta', cls: 'danger', onClick: () => {
      setTimeout(async () => {
        if (!(await askConfirm('Cancelar venta ' + folio, 'Se regresarán los productos al inventario y la venta dejará de contar en los totales. Si el corte de caja de ese día ya se cerró, no se modificará.', 'Sí, cancelar', true))) return;
        try { Store.sales.cancel(folio, App.user.name); toast('Venta cancelada.'); render($('view')); App.refreshStatus(); }
        catch (e) { toast(e.message, true); }
      }, 50);
    } });
    openModal('Venta ' + folio, body, btns);
  }
})();
