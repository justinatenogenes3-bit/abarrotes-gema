/* modulos/tiendas/tiendas.js · Elegir tienda antes del acceso, nombre de la tienda en pantalla y «Todas las tiendas» (administrador)
   Se conecta con App sin modificar los módulos existentes. Datos: modulos/tiendas/tiendas.datos.js */
(function () {
  'use strict';
  const { $, esc, moneda, aviso, abrirVentana } = App;

  /* ---------- 1) Pantalla «Elige tu tienda» antes del acceso ---------- */
  function pantallaTiendas(alElegir) {
    let raiz = $('pantallaTiendas');
    if (!raiz) { raiz = document.createElement('div'); raiz.id = 'pantallaTiendas'; raiz.className = 'acceso'; document.body.appendChild(raiz); }
    raiz.classList.remove('oculto');
    const tiendas = Tiendas.todas(), espacios = Math.max(4, tiendas.length);
    const botones = [];
    for (let i = 0; i < espacios; i++) {
      const t = tiendas[i];
      botones.push(t
        ? `<button type="button" class="tienda-boton" data-tienda="${esc(t.id)}"><span class="tienda-icono">${t.icono}</span><b>${esc(t.nombre)}</b></button>`
        : '<div class="tienda-boton libre"><span class="muted">Espacio disponible</span></div>');
    }
    raiz.innerHTML = `<div class="acceso-tarjeta tiendas-tarjeta">
      <div class="brand">🛒 Abarrotes <span>Gema</span></div>
      <p class="muted">Punto de venta · Elige tu tienda</p>
      <div class="tiendas-rejilla">${botones.join('')}</div>
      <div class="muted" style="text-align:center">Cada tienda guarda su propia información.</div>
    </div>`;
    raiz.onclick = e => {
      const b = e.target.closest('[data-tienda]'); if (!b) return;
      if (!Tiendas.seleccionar(b.dataset.tienda)) { aviso('No se pudo abrir esa tienda.', true); return; }
      raiz.classList.add('oculto'); raiz.innerHTML = '';
      alElegir();
    };
  }

  // Nombre con la última palabra resaltada (igual que «Abarrotes Gema»); sep = separador entre las partes
  function marca(t, sep) {
    const palabras = String(t.nombre).trim().split(/\s+/);
    if (palabras.length < 2) return `${t.icono} ${esc(t.nombre)}`;
    const ultima = palabras.pop();
    return `${t.icono} ${esc(palabras.join(' '))}${sep}<span>${esc(ultima)}</span>`;
  }

  const registrarAccesoOriginal = App.registrarAcceso;
  App.registrarAcceso = a => registrarAccesoOriginal({
    mostrar() {
      pantallaTiendas(() => {
        a.mostrar();
        const tarjeta = $('formAcceso'); if (!tarjeta) return;
        const t = Tiendas.activa();
        // Título de la tarjeta = tienda a la que se va a entrar
        tarjeta.querySelector('.brand').innerHTML = marca(t, ' ');
        tarjeta.querySelector('p').textContent = 'Punto de venta · Elige tu usuario';
        tarjeta.insertAdjacentHTML('afterbegin', `<div class="tienda-actual"><span>📍 Entrarás a: <b>${esc(t.nombre)}</b></span><button type="button" class="sm" id="btnCambiarTienda">Cambiar tienda</button></div>`);
        tarjeta.querySelector('button[type="submit"]').textContent = 'Entrar a ' + t.nombre;
        $('btnCambiarTienda').onclick = () => { $('pantallaAcceso').classList.add('oculto'); $('pantallaAcceso').innerHTML = ''; App.cerrarSesion(); };
      });
    }
  });

  /* ---------- 2) Nombre de la tienda en la barra lateral izquierda y en la barra superior ---------- */
  const iniciarOriginal = App.iniciar;
  App.iniciar = u => {
    iniciarOriginal(u);
    const t = Tiendas.activa();
    const marcaLateral = $('marcaTienda');
    marcaLateral.innerHTML = marca(t, '<br>');
    marcaLateral.classList.toggle('larga', t.nombre.length > 16);
    document.title = t.nombre + ' | Punto de Venta';
    const viejo = $('etiquetaTienda'); if (viejo) viejo.remove();
    $('estadoPendientes').insertAdjacentHTML('afterend', `<div class="status ok" id="etiquetaTienda">${t.icono} ${esc(t.nombre)}</div>`);
  };

  /* ---------- 3) «Todas las tiendas»: inventario de todas las tiendas, en el menú lateral (solo administrador) ---------- */
  const estadoProducto = p => p.existencia <= 0 ? '<span class="pill off">Agotado</span>' : p.existencia <= p.minimo ? '<span class="pill low">Stock bajo</span>' : '<span class="pill">Disponible</span>';

  function pintarResumen() {
    const filas = Tiendas.resumen();
    const total = filas.reduce((t, f) => ({ productos: t.productos + f.productos, bajos: t.bajos + f.bajos, agotados: t.agotados + f.agotados, valor: t.valor + f.valor }), { productos: 0, bajos: 0, agotados: 0, valor: 0 });
    $('resumenTiendas').innerHTML = `<h2>Resumen por tienda</h2>
      <div class="tablewrap"><table><thead><tr><th>Tienda</th><th>Productos</th><th>Stock bajo</th><th>Agotados</th><th>Valor del inventario</th></tr></thead><tbody>
      ${filas.map(f => `<tr><td><b>${f.tienda.icono} ${esc(f.tienda.nombre)}</b> ${f.activa ? '<span class="pill">Tienda actual</span>' : ''}</td><td>${f.productos}</td><td>${f.bajos ? `<span class="pill low">${f.bajos}</span>` : 0}</td><td>${f.agotados ? `<span class="pill off">${f.agotados}</span>` : 0}</td><td>${moneda(f.valor)}</td></tr>`).join('')}
      <tr><td><b>Total</b></td><td><b>${total.productos}</b></td><td><b>${total.bajos}</b></td><td><b>${total.agotados}</b></td><td><b>${moneda(total.valor)}</b></td></tr>
      </tbody></table></div>`;
  }

  function mostrarGlobal(vista) {
    let filtro = 'todas';
    vista.innerHTML = `
      <div class="heading"><div><h1>🏬 Todas las tiendas</h1><div class="muted">Inventario de cada tienda. Es solo de consulta: para cambiar productos entra a esa tienda.</div></div>
        <button class="primary" id="btnNuevaTienda">+ Nueva tienda</button></div>
      <div class="card" id="resumenTiendas"></div>
      <div class="card" style="margin-top:16px">
        <h2>Productos de todas las tiendas</h2>
        <div class="row"><input id="buscarGlobal" class="grow" placeholder="Buscar producto o código…"></div>
        <div class="chips" id="filtrosTienda"></div>
        <div class="tablewrap"><table><thead><tr><th>Tienda</th><th>Código</th><th>Producto</th><th>Precio</th><th>Existencia</th><th>Unidad</th><th>Estado</th></tr></thead><tbody id="filasGlobal"></tbody></table></div>
      </div>`;

    function pintarDetalle() {
      const texto = $('buscarGlobal').value.trim().toLowerCase();
      $('filtrosTienda').innerHTML = [{ id: 'todas', nombre: 'Todas' }, ...Tiendas.todas()]
        .map(t => `<button type="button" class="${filtro === t.id ? 'primary' : ''}" data-filtro="${esc(t.id)}">${t.icono ? t.icono + ' ' : ''}${esc(t.nombre)}</button>`).join('');
      const filas = Tiendas.inventarioTodas().filter(f => (filtro === 'todas' || f.tienda.id === filtro)
        && (!texto || String(f.producto.nombre).toLowerCase().includes(texto) || String(f.producto.codigo || '').includes(texto)));
      $('filasGlobal').innerHTML = filas.map(({ tienda, producto: p }) => `<tr>
        <td>${tienda.icono} ${esc(tienda.nombre)}</td><td>${esc(p.codigo) || '—'}</td><td><b>${esc(p.nombre)}</b></td><td>${moneda(p.precio)}</td>
        <td>${App.formatoCant(p.existencia)}</td><td>${esc(p.unidad)}</td><td>${estadoProducto(p)}</td></tr>`).join('')
        || '<tr><td colspan="7" class="empty">No hay productos que coincidan.</td></tr>';
    }

    vista.onclick = e => {
      const f = e.target.closest('[data-filtro]');
      if (f) { filtro = f.dataset.filtro; pintarDetalle(); return; }
      if (!e.target.closest('#btnNuevaTienda')) return;
      abrirVentana('Nueva tienda', '<label class="muted">Nombre de la tienda<input id="fNombreTienda" class="big" style="width:100%;margin-top:6px"></label>',
        [{ texto: 'Cancelar' }, { texto: 'Agregar', clase: 'primary', alPulsar: () => {
          try { Tiendas.agregar($('fNombreTienda').value); aviso('Tienda agregada.'); mostrarGlobal(vista); }
          catch (err) { aviso(err.message, true); return false; }
        } }]);
    };
    vista.oninput = e => { if (e.target.id === 'buscarGlobal') pintarDetalle(); };
    pintarResumen();
    pintarDetalle();
  }

  // Aparece justo debajo de «Inventario» en el menú lateral
  App.registrar({ id: 'inventarioGlobal', orden: 2.5, icono: '🏬', etiqueta: 'Todas las tiendas', roles: ['Administrador'], mostrar: mostrarGlobal });
})();
