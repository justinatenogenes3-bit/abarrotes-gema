/* modules/inventory/inventory.js · Pantalla de inventario
   Reglas de negocio: modules/inventory/inventory.data.js */
(function () {
  'use strict';
  const { $, money, qty, esc, toast, openModal, askNumber, downloadCSV } = App;

  App.register({ id: 'inventory', order: 2, icon: '📦', label: 'Inventario', roles: ['Administrador', 'Cajero'], render });

  function render(view) {
    const admin = App.isAdmin();
    view.innerHTML = `
      <div class="heading"><div><h1>📦 Inventario</h1><div class="muted">${admin ? 'Entradas, mermas, precios y alertas de stock.' : 'Consulta de productos y existencias.'}</div></div>
        ${admin ? '<button class="primary" id="newProductBtn">+ Nuevo producto</button>' : ''}</div>
      <div class="card">
        <div class="row"><input id="invQ" class="grow" placeholder="Buscar producto o código…">${admin ? '<button id="exportBtn">Exportar CSV</button>' : ''}</div>
        <div class="tablewrap"><table><thead><tr><th>Código</th><th>Producto</th><th>Precio</th><th>Existencia</th><th>Unidad</th><th>Estado</th>${admin ? '<th>Acciones</th>' : ''}</tr></thead><tbody id="invRows"></tbody></table></div>
      </div>
      <div class="cards3" id="invMetrics"></div>`;
    view.onclick = onClick;
    view.oninput = e => { if (e.target.id === 'invQ') renderRows(); };
    renderRows();
  }

  function renderRows() {
    const admin = App.isAdmin();
    const list = Store.inventory.search($('invQ').value);
    $('invRows').innerHTML = list.map(p => `<tr>
      <td>${esc(p.code) || '—'}</td><td><b>${esc(p.name)}</b></td><td>${money(p.price)}</td><td>${qty(p.stock)}</td><td>${p.unit}</td>
      <td>${p.stock <= 0 ? '<span class="pill off">Agotado</span>' : p.stock <= p.low ? '<span class="pill low">Stock bajo</span>' : '<span class="pill">Disponible</span>'}</td>
      ${admin ? `<td><button class="sm" data-act="entry" data-id="${p.id}">+ Entrada</button> <button class="sm" data-act="loss" data-id="${p.id}">Merma</button> <button class="sm" data-act="edit" data-id="${p.id}">Editar</button></td>` : ''}
    </tr>`).join('') || '<tr><td colspan="7" class="empty">No hay productos que coincidan.</td></tr>';
    const all = Store.inventory.all();
    $('invMetrics').innerHTML = `
      <div class="card"><div class="metriclabel">Productos</div><div class="metric">${all.length}</div></div>
      <div class="card"><div class="metriclabel">Con stock bajo</div><div class="metric">${all.filter(p => p.stock > 0 && p.stock <= p.low).length}</div></div>
      <div class="card"><div class="metriclabel">Agotados</div><div class="metric">${all.filter(p => p.stock <= 0).length}</div></div>`;
  }

  function productForm(id) {
    const p = id ? Store.inventory.product(id) : { name: '', code: '', price: '', stock: 0, unit: 'PZ', low: 5 };
    openModal(id ? 'Editar producto' : 'Nuevo producto', `<div class="formgrid">
      <label class="wide">Nombre<input id="fName" value="${esc(p.name)}"></label>
      <label>Código de barras<input id="fCode" value="${esc(p.code)}" inputmode="numeric"></label>
      <label>Precio ($, por pieza o por kilo)<input id="fPrice" type="number" inputmode="decimal" min="0" step=".01" value="${p.price}"></label>
      <label>Existencia<input id="fStock" type="number" inputmode="decimal" min="0" step=".001" value="${p.stock}"></label>
      <label>Unidad<select id="fUnit">${['PZ', 'KG', 'LT'].map(u => `<option ${p.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      <label class="wide">Avisar de stock bajo cuando queden…<input id="fLow" type="number" inputmode="decimal" min="0" value="${p.low}"></label>
    </div>`,
      [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: () => {
        try {
          Store.inventory.save({ name: $('fName').value, code: $('fCode').value, price: $('fPrice').value, stock: $('fStock').value,
                                 unit: $('fUnit').value, low: $('fLow').value, userName: App.user.name }, id || undefined);
          toast('Producto guardado.'); renderRows(); App.refreshStatus();
        } catch (e) { toast(e.message, true); return false; }
      } }]);
  }

  async function stockMove(id, kind) {
    const p = Store.inventory.product(id), entry = kind === 'entry';
    const v = await askNumber(entry ? 'Entrada de mercancía' : 'Registrar merma',
      `${p.name} · existencia actual ${qty(p.stock)} ${p.unit}. ${entry ? 'Cantidad que entra:' : 'Cantidad dañada/caducada que sale:'}`, { okText: 'Guardar' });
    if (v == null) return;
    try {
      Store.inventory.adjust(id, entry ? v : -v, entry ? 'Entrada' : 'Merma', '', App.user.name);
      toast(entry ? 'Entrada registrada.' : 'Merma registrada.'); renderRows(); App.refreshStatus();
    } catch (e) { toast(e.message, true); }
  }

  function onClick(e) {
    if (e.target.closest('#newProductBtn')) return productForm();
    if (e.target.closest('#exportBtn')) return downloadCSV('inventario_abarrotes_gema.csv',
      [['Código', 'Producto', 'Precio', 'Existencia', 'Unidad'], ...Store.inventory.all().map(p => [p.code, p.name, p.price, p.stock, p.unit])]);
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = +b.dataset.id;
    if (b.dataset.act === 'edit') productForm(id);
    else if (b.dataset.act === 'entry') stockMove(id, 'entry');
    else if (b.dataset.act === 'loss') stockMove(id, 'loss');
  }
})();
