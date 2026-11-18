/* modulos/ventas/ventas.js · Pantalla de ventas (Inicio / Ventas)
   Reglas de negocio: modulos/ventas/ventas.datos.js */
(function () {
  'use strict';
  const { $, moneda, redondear, formatoCant, esc, esFraccionable, esTactil, aviso, abrirVentana, cerrarVentana, pedirNumero, pedirConfirmacion } = App;

  let carrito = [], metodo = 'Efectivo', descuento = 0, sugeridos = [], indiceSug = 0;

  App.registrar({ id: 'ventas', orden: 1, icono: '🏠', etiqueta: 'Inicio / Ventas', roles: ['Administrador', 'Cajero'], mostrar });
  App.alSalir(() => carrito.length ? 'Hay una venta sin cobrar; se descartará al salir.' : null);

  /* ---------- Pantalla ---------- */
  function mostrar(vista) {
    vista.innerHTML = `
      <div class="heading"><div><h1>🛒 Punto de Venta</h1><div class="muted">Registra productos, calcula importes y cobra de forma sencilla.</div></div><span class="tag">Abarrotes Gema · POS</span></div>
      <div id="avisoCaja"></div>
      <div class="pos">
        <div class="card">
          <div class="busqueda">
            <input id="codigoBarras" class="codigo" placeholder="▥ Código de barras" autocomplete="off" inputmode="numeric">
            <div class="contenedor-sugerencias">
              <input id="nombreProducto" placeholder="Nombre o código del producto" autocomplete="off">
              <div id="sugerencias" class="sugerencias oculto"></div>
            </div>
            <button class="primary" id="btnAgregar">+ Agregar</button>
          </div>
          <div class="row" style="margin-top:10px"><button id="btnPeso">⚖ Producto por peso</button><span class="muted">Para productos a granel captura manualmente los kilogramos.</span></div>
          <div class="tablewrap"><table><thead><tr><th>Descripción</th><th>Precio unitario</th><th>Cantidad</th><th>Unidad</th><th>Importe</th><th></th></tr></thead><tbody id="filasVenta"></tbody></table></div>
          <div class="row between" style="margin-top:14px"><button class="danger" id="btnVaciar">Eliminar todo</button><span class="muted" id="contador"></span></div>
        </div>

        <div class="card">
          <h2>Resumen de venta</h2>
          <div class="summaryline"><span>Subtotal</span><b id="subtotal">$0.00</b></div>
          <div class="summaryline"><span>Descuento ($)</span><input id="descuento" class="input-descuento" type="number" inputmode="decimal" min="0" step=".01" placeholder="0.00"></div>
          <div class="summaryline big"><span>Total</span><span id="total">$0.00</span></div>
          <label class="muted" for="metodoPago">Método de pago</label>
          <select id="metodoPago" class="select-pago">${Almacen.ventas.METODOS.map(m => `<option>${m}</option>`).join('')}</select>
          <div id="bloqueReferencia" class="bloque-referencia oculto">
            <label for="referencia" id="etiquetaReferencia"></label>
            <input id="referencia" autocomplete="off">
            <div class="muted" id="ayudaReferencia"></div>
          </div>
          <div id="cajaEfectivo">
            <label class="muted" for="recibido">Efectivo recibido</label>
            <input id="recibido" type="number" inputmode="decimal" min="0" step=".01" placeholder="0.00" style="width:100%;margin:6px 0">
            <div class="chips" id="atajos"></div>
            <div class="linea-cambio"><span>Cambio</span><span id="cambio">$0.00</span></div>
          </div>
          <button class="primary xl" id="btnCobrar">💳 Cobrar (F8)</button>
        </div>
      </div>`;

    $('metodoPago').value = metodo;
    $('descuento').value = descuento || '';
    vista.onclick = alHacerClic;
    vista.oninput = alEscribir;
    vista.onchange = alEscribir;
    vista.onkeydown = alTeclear;
    pintarAvisoCaja(); pintarCarrito();
    if (!esTactil) $('codigoBarras').focus();
  }

  function pintarAvisoCaja() {
    $('avisoCaja').innerHTML = Almacen.caja.actual() ? '' :
      `<div class="note warn" style="margin-bottom:14px">La caja está cerrada, no se pueden registrar ventas. <button class="primary sm" id="btnIrCaja" style="margin-left:8px">Abrir caja</button></div>`;
  }

  /* ---------- Carrito ---------- */
  const subtotalCarrito = () => redondear(carrito.reduce((a, i) => a + redondear(i.precio * i.cantidad), 0));

  function pintarCarrito() {
    $('filasVenta').innerHTML = carrito.map((i, idx) => `<tr>
      <td><b>${esc(i.nombre)}</b><br><small class="muted">${esc(i.codigo)}</small></td>
      <td>${moneda(i.precio)}</td>
      <td>${esFraccionable(i.unidad)
        ? `<div class="control-cantidad"><span style="min-width:auto">${formatoCant(i.cantidad)}</span><button data-accion="cambiarCantidad" data-i="${idx}" title="Cambiar cantidad">✎</button></div>`
        : `<div class="control-cantidad"><button data-accion="menos" data-i="${idx}">−</button><span>${formatoCant(i.cantidad)}</span><button data-accion="mas" data-i="${idx}">+</button></div>`}</td>
      <td>${i.unidad}</td>
      <td><b>${moneda(redondear(i.precio * i.cantidad))}</b></td>
      <td><button class="danger" data-accion="quitar" data-i="${idx}" aria-label="Quitar">×</button></td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty">Agrega productos para comenzar la venta.</td></tr>';
    $('contador').textContent = carrito.length + (carrito.length === 1 ? ' artículo' : ' artículos');
    actualizarTotales();
  }

  function actualizarTotales() {
    const sub = subtotalCarrito();
    if (descuento > sub) { descuento = sub; $('descuento').value = descuento || ''; }
    const total = redondear(sub - descuento);
    $('subtotal').textContent = moneda(sub);
    $('total').textContent = moneda(total);

    const regla = Almacen.ventas.reglaReferencia(metodo);          // tarjeta / transferencia piden referencia
    $('cajaEfectivo').classList.toggle('oculto', metodo !== 'Efectivo');
    $('bloqueReferencia').classList.toggle('oculto', !regla);
    if (regla) {
      $('etiquetaReferencia').textContent = '* ' + regla.etiqueta;
      $('ayudaReferencia').textContent = regla.ayuda;
      $('referencia').setAttribute('inputmode', regla.soloNumeros ? 'numeric' : 'text');
    }
    const recibido = Number($('recibido').value) || 0;
    $('cambio').textContent = moneda(Math.max(0, redondear(recibido - total)));
    const opciones = [...new Set([total, 20, 50, 100, 200, 500, 1000].filter(v => v >= total && v > 0))].slice(0, 5);
    $('atajos').innerHTML = opciones.map(v => `<button data-atajo="${v}">${v === total ? 'Exacto' : moneda(v)}</button>`).join('');
  }

  async function agregarProducto(p) {
    if (!Almacen.caja.actual()) { aviso('Abre la caja antes de vender.', true); pintarAvisoCaja(); return; }
    if (p.existencia <= 0) { aviso('Producto agotado.', true); return; }
    let cantidad = 1;
    if (esFraccionable(p.unidad)) {
      cantidad = await pedirNumero(p.nombre, `Cantidad en ${p.unidad === 'KG' ? 'kilogramos (ej. 1.5)' : p.unidad} · ${moneda(p.precio)} por ${p.unidad}`,
        { atajos: p.unidad === 'KG' ? ['0.25', '0.5', '1', '2'] : [], textoOk: 'Agregar' });
      if (cantidad == null) return;
    }
    const enCarrito = carrito.find(i => i.id === p.id);
    const total = Math.round(((enCarrito ? enCarrito.cantidad : 0) + cantidad) * 1000) / 1000;
    if (total > p.existencia) { aviso(`Solo hay ${formatoCant(p.existencia)} ${p.unidad} de ${p.nombre}.`, true); return; }
    if (enCarrito) enCarrito.cantidad = total;
    else carrito.push({ id: p.id, codigo: p.codigo, nombre: p.nombre, precio: p.precio, unidad: p.unidad, cantidad });
    limpiarBusqueda();
    pintarCarrito();
  }

  function limpiarBusqueda() {
    $('codigoBarras').value = ''; $('nombreProducto').value = '';
    ocultarSugerencias();
    if (!esTactil) $('codigoBarras').focus();
  }

  /* ---------- Sugerencias al escribir el nombre ---------- */
  function mostrarSugerencias(texto) {
    sugeridos = texto.trim() ? Almacen.inventario.buscar(texto).slice(0, 8) : [];
    indiceSug = 0;
    pintarSugerencias();
  }
  function pintarSugerencias() {
    const caja = $('sugerencias');
    if (!sugeridos.length) { caja.classList.add('oculto'); caja.innerHTML = ''; return; }
    caja.classList.remove('oculto');
    caja.innerHTML = sugeridos.map((p, i) => `<button class="${i === indiceSug ? 'activa' : ''}" data-sugerido="${p.id}">
      <span><b>${esc(p.nombre)}</b><br><small>${p.existencia <= 0 ? 'Agotado' : 'Hay ' + formatoCant(p.existencia) + ' ' + p.unidad}</small></span><b>${moneda(p.precio)}${esFraccionable(p.unidad) ? '/' + p.unidad : ''}</b></button>`).join('');
  }
  function ocultarSugerencias() { sugeridos = []; pintarSugerencias(); }

  /* ---------- Producto por peso ---------- */
  function elegirProductoPorPeso() {
    const lista = Almacen.inventario.todos().filter(p => esFraccionable(p.unidad));
    if (!lista.length) { aviso('No hay productos por peso. Registra uno en Inventario con unidad KG.', true); return; }
    abrirVentana('Producto por peso', `<div class="lista-peso">${lista.map(p =>
      `<button data-peso="${p.id}"><span>${esc(p.nombre)}</span><span>${moneda(p.precio)}/${p.unidad}</span></button>`).join('')}</div>`,
      [{ texto: 'Cancelar' }]);
    $('raizVentana').querySelectorAll('[data-peso]').forEach(b => b.onclick = e => {
      e.stopPropagation(); cerrarVentana(); agregarProducto(Almacen.inventario.producto(+b.dataset.peso));
    });
  }

  /* ---------- Cobro ---------- */
  function cobrar() {
    try {
      const venta = Almacen.ventas.agregar({ partidas: carrito, metodo, recibido: Number($('recibido').value),
                                             descuento, referencia: $('referencia').value, usuario: App.usuario.nombre });
      carrito = []; descuento = 0;
      $('descuento').value = ''; $('recibido').value = ''; $('referencia').value = '';
      pintarCarrito(); App.actualizarEstado();
      const cuerpo = `<div class="muted" style="text-align:center">Folio ${venta.folio} · ${esc(venta.metodo)}</div>
        <div class="summaryline"><span>Subtotal</span><b>${moneda(venta.subtotal)}</b></div>
        ${venta.descuento ? `<div class="summaryline"><span>Descuento</span><b>-${moneda(venta.descuento)}</b></div>` : ''}
        <div class="summaryline"><span>Total</span><b>${moneda(venta.total)}</b></div>
        ${venta.referencia ? `<div class="summaryline"><span>Referencia</span><b>${esc(venta.referencia)}</b></div>` : ''}
        ${venta.metodo === 'Efectivo' ? `<div class="summaryline"><span>Recibido</span><b>${moneda(venta.recibido)}</b></div>
          <div class="muted" style="text-align:center;margin-top:10px">Entregar de cambio</div><div class="bigmoney">${moneda(venta.cambio)}</div>` : ''}`;
      abrirVentana('✅ Venta registrada', cuerpo, [{ texto: 'Nueva venta', clase: 'primary', alPulsar: () => { if (!esTactil && $('codigoBarras')) $('codigoBarras').focus(); } }]);
    } catch (err) {
      aviso(err.message, true);
      if (err.campo === 'referencia') $('referencia').focus();
    }
  }
  // F8 cobra desde cualquier parte de la pantalla de ventas
  document.addEventListener('keydown', e => {
    if (e.key === 'F8' && App.actual === 'ventas' && !$('raizVentana').innerHTML) { e.preventDefault(); cobrar(); }
  });

  /* ---------- Eventos de esta pantalla ---------- */
  async function alHacerClic(e) {
    const t = e.target;
    if (t.closest('#btnIrCaja')) return App.ir('caja');
    const sug = t.closest('[data-sugerido]'); if (sug) return agregarProducto(Almacen.inventario.producto(+sug.dataset.sugerido));
    const atajo = t.closest('[data-atajo]'); if (atajo) { $('recibido').value = atajo.dataset.atajo; return actualizarTotales(); }
    if (!t.closest('.contenedor-sugerencias')) ocultarSugerencias();
    if (t.closest('#btnAgregar')) return agregarDesdeCampos();
    if (t.closest('#btnPeso')) return elegirProductoPorPeso();
    if (t.closest('#btnCobrar')) return cobrar();
    if (t.closest('#btnVaciar')) {
      if (carrito.length && await pedirConfirmacion('Eliminar todo', '¿Quitar todos los productos de la venta actual?', 'Eliminar', true)) { carrito = []; pintarCarrito(); }
      return;
    }
    const b = t.closest('[data-accion]'); if (!b) return;
    const i = +b.dataset.i, linea = carrito[i];
    if (b.dataset.accion === 'mas') { const p = Almacen.inventario.producto(linea.id); if (linea.cantidad + 1 <= p.existencia) { linea.cantidad++; pintarCarrito(); } else aviso('No hay más existencia.', true); }
    else if (b.dataset.accion === 'menos') { linea.cantidad--; if (linea.cantidad <= 0) carrito.splice(i, 1); pintarCarrito(); }
    else if (b.dataset.accion === 'quitar') { carrito.splice(i, 1); pintarCarrito(); }
    else if (b.dataset.accion === 'cambiarCantidad') {
      const p = Almacen.inventario.producto(linea.id);
      const v = await pedirNumero(linea.nombre, `Nueva cantidad en ${linea.unidad} (hay ${formatoCant(p.existencia)})`, { valor: linea.cantidad, textoOk: 'Guardar' });
      if (v == null) return;
      if (v > p.existencia) { aviso(`Solo hay ${formatoCant(p.existencia)} ${p.unidad}.`, true); return; }
      linea.cantidad = v; pintarCarrito();
    }
  }

  function alEscribir(e) {
    const id = e.target.id;
    if (id === 'nombreProducto') mostrarSugerencias(e.target.value);
    else if (id === 'descuento') { descuento = Math.max(0, redondear(e.target.value)) || 0; actualizarTotales(); }
    else if (id === 'recibido') actualizarTotales();
    else if (id === 'metodoPago') { metodo = e.target.value; $('referencia').value = ''; actualizarTotales(); }
    else if (id === 'referencia') {
      const regla = Almacen.ventas.reglaReferencia(metodo);
      e.target.value = regla && regla.soloNumeros ? e.target.value.replace(/\D/g, '') : e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    }
  }

  function alTeclear(e) {
    const id = e.target.id;
    if (id === 'codigoBarras' && e.key === 'Enter') {          // lector de código de barras
      const codigo = e.target.value.trim(); if (!codigo) return;
      const p = Almacen.inventario.buscarPorCodigo(codigo);
      if (p) agregarProducto(p); else aviso('Producto no encontrado. Revisa el código o regístralo en Inventario.', true);
    } else if (id === 'nombreProducto') {
      if (e.key === 'ArrowDown' && sugeridos.length) { e.preventDefault(); indiceSug = (indiceSug + 1) % sugeridos.length; pintarSugerencias(); }
      else if (e.key === 'ArrowUp' && sugeridos.length) { e.preventDefault(); indiceSug = (indiceSug - 1 + sugeridos.length) % sugeridos.length; pintarSugerencias(); }
      else if (e.key === 'Escape') ocultarSugerencias();
      else if (e.key === 'Enter') { e.preventDefault(); agregarDesdeCampos(); }
    } else if ((id === 'recibido' || id === 'referencia') && e.key === 'Enter') { e.preventDefault(); cobrar(); }
  }

  function agregarDesdeCampos() {
    const codigo = $('codigoBarras').value.trim(), nombre = $('nombreProducto').value.trim();
    let p = null;
    if (codigo) p = Almacen.inventario.buscarPorCodigo(codigo);
    else if (nombre) p = sugeridos[indiceSug] || Almacen.inventario.buscarPorCodigo(nombre) || Almacen.inventario.buscar(nombre)[0];
    if (p) agregarProducto(p);
    else if (codigo || nombre) aviso('Producto no encontrado. Revisa el código o regístralo en Inventario.', true);
    else aviso('Escribe o escanea un código de barras.', true);
  }
})();
