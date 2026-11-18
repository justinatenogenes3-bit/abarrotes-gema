/* modulos/inventario/inventario.js · Pantalla de inventario
   Reglas de negocio: modulos/inventario/inventario.datos.js */
(function () {
  'use strict';
  const { $, moneda, formatoCant, esc, aviso, abrirVentana, pedirNumero, descargarCSV } = App;

  App.registrar({ id: 'inventario', orden: 2, icono: '📦', etiqueta: 'Inventario', roles: ['Administrador', 'Cajero'], mostrar });

  function mostrar(vista) {
    const admin = App.esAdmin();
    vista.innerHTML = `
      <div class="heading"><div><h1>📦 Inventario</h1><div class="muted">${admin ? 'Entradas, mermas, precios y alertas de stock.' : 'Consulta de productos y existencias.'}</div></div>
        ${admin ? '<button class="primary" id="btnNuevoProducto">+ Nuevo producto</button>' : ''}</div>
      <div class="card">
        <div class="row"><input id="buscarInventario" class="grow" placeholder="Buscar producto o código…">${admin ? '<button id="btnExportar">Exportar CSV</button>' : ''}</div>
        <div class="tablewrap"><table><thead><tr><th>Código</th><th>Producto</th><th>Precio</th><th>Existencia</th><th>Unidad</th><th>Estado</th>${admin ? '<th>Acciones</th>' : ''}</tr></thead><tbody id="filasInventario"></tbody></table></div>
      </div>
      <div class="cards3" id="resumenInventario"></div>`;
    vista.onclick = alHacerClic;
    vista.oninput = e => { if (e.target.id === 'buscarInventario') pintarFilas(); };
    pintarFilas();
  }

  function pintarFilas() {
    const admin = App.esAdmin();
    const lista = Almacen.inventario.buscar($('buscarInventario').value);
    $('filasInventario').innerHTML = lista.map(p => `<tr>
      <td>${esc(p.codigo) || '—'}</td><td><b>${esc(p.nombre)}</b></td><td>${moneda(p.precio)}</td><td>${formatoCant(p.existencia)}</td><td>${p.unidad}</td>
      <td>${p.existencia <= 0 ? '<span class="pill off">Agotado</span>' : p.existencia <= p.minimo ? '<span class="pill low">Stock bajo</span>' : '<span class="pill">Disponible</span>'}</td>
      ${admin ? `<td><button class="sm" data-accion="entrada" data-id="${p.id}">+ Entrada</button> <button class="sm" data-accion="merma" data-id="${p.id}">Merma</button> <button class="sm" data-accion="editar" data-id="${p.id}">Editar</button></td>` : ''}
    </tr>`).join('') || '<tr><td colspan="7" class="empty">No hay productos que coincidan.</td></tr>';
    const todos = Almacen.inventario.todos();
    $('resumenInventario').innerHTML = `
      <div class="card"><div class="metriclabel">Productos</div><div class="metric">${todos.length}</div></div>
      <div class="card"><div class="metriclabel">Con stock bajo</div><div class="metric">${todos.filter(p => p.existencia > 0 && p.existencia <= p.minimo).length}</div></div>
      <div class="card"><div class="metriclabel">Agotados</div><div class="metric">${todos.filter(p => p.existencia <= 0).length}</div></div>`;
  }

  function formularioProducto(id) {
    const p = id ? Almacen.inventario.producto(id) : { nombre: '', codigo: '', precio: '', existencia: 0, unidad: 'PZ', minimo: 5 };
    abrirVentana(id ? 'Editar producto' : 'Nuevo producto', `<div class="formgrid">
      <label class="wide">Nombre<input id="fNombre" value="${esc(p.nombre)}"></label>
      <label>Código de barras<input id="fCodigo" value="${esc(p.codigo)}" inputmode="numeric"></label>
      <label>Precio ($, por pieza o por kilo)<input id="fPrecio" type="number" inputmode="decimal" min="0" step=".01" value="${p.precio}"></label>
      <label>Existencia<input id="fExistencia" type="number" inputmode="decimal" min="0" step=".001" value="${p.existencia}"></label>
      <label>Unidad<select id="fUnidad">${['PZ', 'KG', 'LT'].map(u => `<option ${p.unidad === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      <label class="wide">Avisar de stock bajo cuando queden…<input id="fMinimo" type="number" inputmode="decimal" min="0" value="${p.minimo}"></label>
    </div>`,
      [{ texto: 'Cancelar' }, { texto: 'Guardar', clase: 'primary', alPulsar: () => {
        try {
          Almacen.inventario.guardarProducto({ nombre: $('fNombre').value, codigo: $('fCodigo').value, precio: $('fPrecio').value,
            existencia: $('fExistencia').value, unidad: $('fUnidad').value, minimo: $('fMinimo').value, usuario: App.usuario.nombre }, id || undefined);
          aviso('Producto guardado.'); pintarFilas(); App.actualizarEstado();
        } catch (e) { aviso(e.message, true); return false; }
      } }]);
  }

  async function moverExistencia(id, tipo) {
    const p = Almacen.inventario.producto(id), entrada = tipo === 'entrada';
    const v = await pedirNumero(entrada ? 'Entrada de mercancía' : 'Registrar merma',
      `${p.nombre} · existencia actual ${formatoCant(p.existencia)} ${p.unidad}. ${entrada ? 'Cantidad que entra:' : 'Cantidad dañada/caducada que sale:'}`, { textoOk: 'Guardar' });
    if (v == null) return;
    try {
      Almacen.inventario.ajustar(id, entrada ? v : -v, entrada ? 'Entrada' : 'Merma', '', App.usuario.nombre);
      aviso(entrada ? 'Entrada registrada.' : 'Merma registrada.'); pintarFilas(); App.actualizarEstado();
    } catch (e) { aviso(e.message, true); }
  }

  function alHacerClic(e) {
    if (e.target.closest('#btnNuevoProducto')) return formularioProducto();
    if (e.target.closest('#btnExportar')) return descargarCSV('inventario_abarrotes_gema.csv',
      [['Código', 'Producto', 'Precio', 'Existencia', 'Unidad'], ...Almacen.inventario.todos().map(p => [p.codigo, p.nombre, p.precio, p.existencia, p.unidad])]);
    const b = e.target.closest('[data-accion]'); if (!b) return;
    const id = +b.dataset.id;
    if (b.dataset.accion === 'editar') formularioProducto(id);
    else if (b.dataset.accion === 'entrada') moverExistencia(id, 'entrada');
    else if (b.dataset.accion === 'merma') moverExistencia(id, 'merma');
  }
})();
