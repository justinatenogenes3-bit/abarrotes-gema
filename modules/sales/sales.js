/* modules/sales/sales.js · Pantalla de ventas (Inicio / Ventas)
   Reglas de negocio: modules/sales/sales.data.js */
(function () {
  'use strict';
  const { $, money, r2, qty, esc, isToday, isFractional, touchDevice, toast, openModal, askNumber, askConfirm } = App;

  let cart = [], pay = 'Efectivo', discount = 0, sugg = [], suggIdx = 0;

  App.register({ id: 'sales', order: 1, icon: '🏠', label: 'Inicio / Ventas', roles: ['Administrador', 'Cajero'], render });
  App.onBeforeLogout(() => cart.length ? 'Hay una venta sin cobrar; se descartará al salir.' : null);

  /* ---------- Pantalla ---------- */
  function render(view) {
    view.innerHTML = `
      <div class="heading"><div><h1>🛒 Punto de Venta</h1><div class="muted">Registra productos, calcula importes y cobra de forma sencilla.</div></div><span class="tag">Abarrotes Gema · POS</span></div>
      <div id="cashBanner"></div>
      <div class="pos">
        <div class="card">
          <div class="pos-find">
            <input id="barcode" class="code" placeholder="▥ Código de barras" autocomplete="off" inputmode="numeric">
            <div class="suggest-wrap">
              <input id="saleName" placeholder="Nombre o código del producto" autocomplete="off">
              <div id="suggest" class="suggest hidden"></div>
            </div>
            <button class="primary" id="addBtn">+ Agregar</button>
          </div>
          <div class="row" style="margin-top:10px"><button id="weightBtn">⚖ Producto por peso</button><span class="muted">Para productos a granel captura manualmente los kilogramos.</span></div>
          <div class="tablewrap"><table><thead><tr><th>Descripción</th><th>Precio unitario</th><th>Cantidad</th><th>Unidad</th><th>Importe</th><th></th></tr></thead><tbody id="saleRows"></tbody></table></div>
          <div class="row between" style="margin-top:14px"><button class="danger" id="clearBtn">Eliminar todo</button><span class="muted" id="itemCount"></span></div>
        </div>

        <div class="card">
          <h2>Resumen de venta</h2>
          <div class="summaryline"><span>Subtotal</span><b id="subtotal">$0.00</b></div>
          <div class="summaryline"><span>Descuento ($)</span><input id="discount" class="discount-input" type="number" inputmode="decimal" min="0" step=".01" placeholder="0.00"></div>
          <div class="summaryline big"><span>Total</span><span id="total">$0.00</span></div>
          <label class="muted" for="payMethod">Método de pago</label>
          <select id="payMethod" class="pay-select">${Store.sales.METHODS.map(m => `<option>${m}</option>`).join('')}</select>
          <div id="cashBox">
            <label class="muted" for="received">Efectivo recibido</label>
            <input id="received" type="number" inputmode="decimal" min="0" step=".01" placeholder="0.00" style="width:100%;margin:6px 0">
            <div class="chips" id="quick"></div>
            <div class="change-line"><span>Cambio</span><span id="changeDue">$0.00</span></div>
          </div>
          <button class="primary xl" id="chargeBtn">💳 Cobrar (F8)</button>
        </div>
      </div>
      <div class="cards3">
        <div class="card"><div class="metriclabel">Ventas de hoy</div><div class="metric" id="mToday">$0.00</div></div>
        <div class="card"><div class="metriclabel">Productos registrados</div><div class="metric" id="mProducts">0</div></div>
        <div class="card"><div class="metriclabel">Sin enviar a la nube</div><div class="metric" id="mPending">0</div></div>
      </div>`;

    $('payMethod').value = pay;
    $('discount').value = discount || '';
    view.onclick = onClick;
    view.oninput = onInput;
    view.onchange = onInput;
    view.onkeydown = onKey;
    renderBanner(); renderCart(); renderMetrics();
    if (!touchDevice) $('barcode').focus();
  }

  function renderBanner() {
    $('cashBanner').innerHTML = Store.cash.current() ? '' :
      `<div class="note warn" style="margin-bottom:14px">La caja está cerrada, no se pueden registrar ventas. <button class="primary sm" id="goCash" style="margin-left:8px">Abrir caja</button></div>`;
  }
  function renderMetrics() {
    const today = Store.sales.all().filter(s => s.status === 'ok' && isToday(s.at)).reduce((a, s) => a + s.total, 0);
    $('mToday').textContent = money(today);
    $('mProducts').textContent = Store.inventory.all().length;
    $('mPending').textContent = Store.pending();
  }

  /* ---------- Carrito ---------- */
  const subtotalOf = () => r2(cart.reduce((a, i) => a + r2(i.price * i.qty), 0));

  function renderCart() {
    $('saleRows').innerHTML = cart.map((i, idx) => `<tr>
      <td><b>${esc(i.name)}</b><br><small class="muted">${esc(i.code)}</small></td>
      <td>${money(i.price)}</td>
      <td>${isFractional(i.unit)
        ? `<div class="cartqty"><span style="min-width:auto">${qty(i.qty)}</span><button data-act="editQty" data-i="${idx}" title="Cambiar cantidad">✎</button></div>`
        : `<div class="cartqty"><button data-act="dec" data-i="${idx}">−</button><span>${qty(i.qty)}</span><button data-act="inc" data-i="${idx}">+</button></div>`}</td>
      <td>${i.unit}</td>
      <td><b>${money(r2(i.price * i.qty))}</b></td>
      <td><button class="danger" data-act="del" data-i="${idx}" aria-label="Quitar">×</button></td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty">Agrega productos para comenzar la venta.</td></tr>';
    $('itemCount').textContent = cart.length + (cart.length === 1 ? ' artículo' : ' artículos');
    updateTotals();
  }

  function updateTotals() {
    const sub = subtotalOf();
    if (discount > sub) { discount = sub; $('discount').value = discount || ''; }
    const total = r2(sub - discount);
    $('subtotal').textContent = money(sub);
    $('total').textContent = money(total);
    $('cashBox').classList.toggle('hidden', pay !== 'Efectivo');
    const rec = Number($('received').value) || 0;
    $('changeDue').textContent = money(Math.max(0, r2(rec - total)));
    const opts = [...new Set([total, 20, 50, 100, 200, 500, 1000].filter(v => v >= total && v > 0))].slice(0, 5);
    $('quick').innerHTML = opts.map(v => `<button data-quick="${v}">${v === total ? 'Exacto' : money(v)}</button>`).join('');
  }

  async function addProduct(p) {
    if (!Store.cash.current()) { toast('Abre la caja antes de vender.', true); renderBanner(); return; }
    if (p.stock <= 0) { toast('Producto agotado.', true); return; }
    let amount = 1;
    if (isFractional(p.unit)) {
      amount = await askNumber(p.name, `Cantidad en ${p.unit === 'KG' ? 'kilogramos (ej. 1.5)' : p.unit} · ${money(p.price)} por ${p.unit}`,
        { chips: p.unit === 'KG' ? ['0.25', '0.5', '1', '2'] : [], okText: 'Agregar' });
      if (amount == null) return;
    }
    const inCart = cart.find(i => i.id === p.id);
    const total = Math.round(((inCart ? inCart.qty : 0) + amount) * 1000) / 1000;
    if (total > p.stock) { toast(`Solo hay ${qty(p.stock)} ${p.unit} de ${p.name}.`, true); return; }
    if (inCart) inCart.qty = total;
    else cart.push({ id: p.id, code: p.code, name: p.name, price: p.price, unit: p.unit, qty: amount });
    clearInputs();
    renderCart();
  }

  function clearInputs() {
    $('barcode').value = ''; $('saleName').value = '';
    hideSuggest();
    if (!touchDevice) $('barcode').focus();
  }

  /* ---------- Sugerencias al escribir el nombre ---------- */
  function showSuggest(q) {
    sugg = q.trim() ? Store.inventory.search(q).slice(0, 8) : [];
    suggIdx = 0;
    drawSuggest();
  }
  function drawSuggest() {
    const box = $('suggest');
    if (!sugg.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    box.innerHTML = sugg.map((p, i) => `<button class="${i === suggIdx ? 'on' : ''}" data-sug="${p.id}">
      <span><b>${esc(p.name)}</b><br><small>${p.stock <= 0 ? 'Agotado' : 'Hay ' + qty(p.stock) + ' ' + p.unit}</small></span><b>${money(p.price)}${isFractional(p.unit) ? '/' + p.unit : ''}</b></button>`).join('');
  }
  function hideSuggest() { sugg = []; drawSuggest(); }

  /* ---------- Producto por peso ---------- */
  function weightPicker() {
    const list = Store.inventory.all().filter(p => isFractional(p.unit));
    if (!list.length) { toast('No hay productos por peso. Registra uno en Inventario con unidad KG.', true); return; }
    openModal('Producto por peso', `<div class="weightlist">${list.map(p =>
      `<button data-w="${p.id}"><span>${esc(p.name)}</span><span>${money(p.price)}/${p.unit}</span></button>`).join('')}</div>`,
      [{ label: 'Cancelar' }]);
    $('modalRoot').querySelectorAll('[data-w]').forEach(b => b.onclick = e => {
      e.stopPropagation(); App.closeModal(); addProduct(Store.inventory.product(+b.dataset.w));
    });
  }

  /* ---------- Cobro ---------- */
  function charge() {
    try {
      const sale = Store.sales.add({ items: cart, method: pay, received: Number($('received').value), discount, userName: App.user.name });
      cart = []; discount = 0;
      $('discount').value = ''; $('received').value = '';
      renderCart(); renderMetrics(); App.refreshStatus();
      const body = `<div class="muted" style="text-align:center">Folio ${sale.folio} · ${esc(sale.method)}</div>
        <div class="summaryline"><span>Subtotal</span><b>${money(sale.subtotal)}</b></div>
        ${sale.discount ? `<div class="summaryline"><span>Descuento</span><b>-${money(sale.discount)}</b></div>` : ''}
        <div class="summaryline"><span>Total</span><b>${money(sale.total)}</b></div>
        ${sale.method === 'Efectivo' ? `<div class="summaryline"><span>Recibido</span><b>${money(sale.received)}</b></div>
          <div class="muted" style="text-align:center;margin-top:10px">Entregar de cambio</div><div class="bigmoney">${money(sale.change)}</div>` : ''}`;
      openModal('✅ Venta registrada', body, [{ label: 'Nueva venta', cls: 'primary', onClick: () => { if (!touchDevice && $('barcode')) $('barcode').focus(); } }]);
    } catch (err) { toast(err.message, true); }
  }
  // F8 cobra desde cualquier parte de la pantalla de ventas
  document.addEventListener('keydown', e => {
    if (e.key === 'F8' && App.current === 'sales' && !$('modalRoot').innerHTML) { e.preventDefault(); charge(); }
  });

  /* ---------- Eventos de esta pantalla ---------- */
  async function onClick(e) {
    const t = e.target;
    if (t.closest('#goCash')) return App.go('cash');
    const sug = t.closest('[data-sug]'); if (sug) return addProduct(Store.inventory.product(+sug.dataset.sug));
    const quick = t.closest('[data-quick]'); if (quick) { $('received').value = quick.dataset.quick; return updateTotals(); }
    if (!t.closest('.suggest-wrap')) hideSuggest();
    if (t.closest('#addBtn')) return addFromInputs();
    if (t.closest('#weightBtn')) return weightPicker();
    if (t.closest('#chargeBtn')) return charge();
    if (t.closest('#clearBtn')) {
      if (cart.length && await askConfirm('Eliminar todo', '¿Quitar todos los productos de la venta actual?', 'Eliminar', true)) { cart = []; renderCart(); }
      return;
    }
    const b = t.closest('[data-act]'); if (!b) return;
    const i = +b.dataset.i, it = cart[i];
    if (b.dataset.act === 'inc') { const p = Store.inventory.product(it.id); if (it.qty + 1 <= p.stock) { it.qty++; renderCart(); } else toast('No hay más existencia.', true); }
    else if (b.dataset.act === 'dec') { it.qty--; if (it.qty <= 0) cart.splice(i, 1); renderCart(); }
    else if (b.dataset.act === 'del') { cart.splice(i, 1); renderCart(); }
    else if (b.dataset.act === 'editQty') {
      const p = Store.inventory.product(it.id);
      const v = await askNumber(it.name, `Nueva cantidad en ${it.unit} (hay ${qty(p.stock)})`, { value: it.qty, okText: 'Guardar' });
      if (v == null) return;
      if (v > p.stock) { toast(`Solo hay ${qty(p.stock)} ${p.unit}.`, true); return; }
      it.qty = v; renderCart();
    }
  }

  function onInput(e) {
    const id = e.target.id;
    if (id === 'saleName') showSuggest(e.target.value);
    else if (id === 'discount') { discount = Math.max(0, r2(e.target.value)) || 0; updateTotals(); }
    else if (id === 'received') updateTotals();
    else if (id === 'payMethod') { pay = e.target.value; updateTotals(); }
  }

  function onKey(e) {
    const id = e.target.id;
    if (id === 'barcode' && e.key === 'Enter') {          // lector de código de barras
      const code = e.target.value.trim(); if (!code) return;
      const p = Store.inventory.findByCode(code);
      if (p) addProduct(p); else toast('Producto no encontrado. Revisa el código o regístralo en Inventario.', true);
    } else if (id === 'saleName') {
      if (e.key === 'ArrowDown' && sugg.length) { e.preventDefault(); suggIdx = (suggIdx + 1) % sugg.length; drawSuggest(); }
      else if (e.key === 'ArrowUp' && sugg.length) { e.preventDefault(); suggIdx = (suggIdx - 1 + sugg.length) % sugg.length; drawSuggest(); }
      else if (e.key === 'Escape') hideSuggest();
      else if (e.key === 'Enter') { e.preventDefault(); addFromInputs(); }
    } else if (id === 'received' && e.key === 'Enter') { e.preventDefault(); charge(); }
  }

  function addFromInputs() {
    const code = $('barcode').value.trim(), name = $('saleName').value.trim();
    let p = null;
    if (code) p = Store.inventory.findByCode(code);
    else if (name) p = sugg[suggIdx] || Store.inventory.findByCode(name) || Store.inventory.search(name)[0];
    if (p) addProduct(p);
    else if (code || name) toast('Producto no encontrado. Revisa el código o regístralo en Inventario.', true);
    else toast('Escribe o escanea un código de barras.', true);
  }
})();
