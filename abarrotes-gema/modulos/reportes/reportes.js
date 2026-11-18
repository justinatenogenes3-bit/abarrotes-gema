/* modulos/reportes/reportes.js · Reportes (solo administrador)
   Solo lee los datos de los demás módulos; la única acción que modifica es cancelar una venta. */
(function () {
  'use strict';
  const { $, moneda, redondear, formatoCant, esc, fechaHora, esHoy, aviso, abrirVentana, pedirConfirmacion, descargarCSV } = App;
  let periodo = 'hoy', busqueda = '';

  App.registrar({
    id: 'reportes', orden: 4, icono: '📊', etiqueta: 'Reportes', roles: ['Administrador'], mostrar,
    insignia: () => Almacen.ventas.alertasPendientes().length,                     // número rojo en el menú
    avisoInicio: () => {                                                            // aviso al entrar el administrador
      const n = Almacen.ventas.alertasPendientes().length;
      return n ? `⚠ Hay ${n} posible${n === 1 ? '' : 's'} cobro${n === 1 ? '' : 's'} duplicado${n === 1 ? '' : 's'} con tarjeta por revisar en Reportes.` : null;
    }
  });

  const enPeriodo = iso => periodo === 'todo' ? true : periodo === 'hoy' ? esHoy(iso) : Date.now() - new Date(iso).getTime() <= 7 * 864e5;
  const subtotalDe = v => v.subtotal ?? v.total;
  const colorDif = d => d === 0 ? 'var(--green)' : d < 0 ? 'var(--red)' : '#b57800';

  function mostrar(vista) {
    const todas = Almacen.ventas.todas();
    const grupos = Almacen.ventas.duplicadosTarjeta();
    const pendientes = grupos.filter(g => g.pendiente);
    const marca = {};                                                               // folio -> ⚠ pendiente / ✓ revisado
    grupos.forEach(g => g.ventas.forEach(v => { marca[v.folio] = g.pendiente ? '⚠' : '✓'; }));
    const vigentes = todas.filter(v => v.estado === 'vigente' && enPeriodo(v.fecha));
    const suma = f => redondear(vigentes.filter(f).reduce((a, v) => a + v.total, 0));
    const ventasHoy = redondear(todas.filter(v => v.estado === 'vigente' && esHoy(v.fecha)).reduce((a, v) => a + v.total, 0));

    // Lista de ventas del periodo (con búsqueda por folio o referencia)
    const q = busqueda.trim().toUpperCase();
    const ventas = todas.filter(v => enPeriodo(v.fecha) && (!q || v.folio.toUpperCase().includes(q) || (v.referencia || '').includes(q)));

    const masVendidos = {};
    vigentes.forEach(v => v.partidas.forEach(i => {
      const t = masVendidos[i.id] || (masVendidos[i.id] = { nombre: i.nombre, unidad: i.unidad, cantidad: 0, importe: 0 });
      t.cantidad += i.cantidad; t.importe += i.importe;
    }));
    const top = Object.values(masVendidos).sort((a, b) => b.importe - a.importe).slice(0, 10);
    const movimientos = Almacen.bd.movimientos.filter(m => enPeriodo(m.fecha)).slice(0, 60);
    const cortes = Almacen.caja.historial().filter(s => enPeriodo(s.cerradaEn));

    vista.innerHTML = `
      <div class="heading"><div><h1>📊 Reportes</h1><div class="muted">Ventas, productos, inventario y cortes de caja.</div></div>
        <div class="row"><select id="periodo"><option value="hoy">Hoy</option><option value="semana">Últimos 7 días</option><option value="todo">Todo</option></select>
        <button id="btnExportar">Exportar ventas CSV</button></div></div>

      ${pendientes.length ? `<div class="note warn" style="margin-bottom:14px">
        <h2 style="margin:0 0 6px">⚠ Posibles cobros duplicados con tarjeta (${pendientes.length})</h2>
        <div>Mismos 4 dígitos y mismo monto el mismo día. Compara con el reporte de la terminal: si ahí aparecen operaciones distintas es una coincidencia normal (márcalo como revisado); si solo aparece una, uno de los cobros pudo registrarse de más.</div>
        ${pendientes.map(g => `<div class="card" style="margin-top:10px">
          <div class="row between"><b>${moneda(g.total)} · terminación ${esc(g.referencia)} · ${g.ventas.length} ventas</b>
            <button class="primary sm" data-revisar="${g.ventas.map(v => v.folio).join(',')}">Marcar como revisado</button></div>
          <div class="tablewrap"><table><thead><tr><th>Folio</th><th>Fecha y hora</th><th>Usuario</th><th></th></tr></thead><tbody>
          ${g.ventas.map(v => `<tr><td>${v.folio}</td><td>${fechaHora(v.fecha)}</td><td>${esc(v.usuario)}</td><td><button class="sm" data-folio="${v.folio}">Ver</button></td></tr>`).join('')}
          </tbody></table></div></div>`).join('')}
      </div>` : ''}

      <div class="cards3">
        <div class="card"><div class="metriclabel">Ventas de hoy</div><div class="metric">${moneda(ventasHoy)}</div></div>
        <div class="card"><div class="metriclabel">Productos registrados</div><div class="metric">${Almacen.inventario.todos().length}</div></div>
        <div class="card"><div class="metriclabel">Sin enviar a la nube</div><div class="metric">${Almacen.pendientes()}</div></div>
      </div>

      <div class="cards5">
        <div class="card"><div class="metriclabel">Ventas realizadas</div><div class="metric">${vigentes.length}</div></div>
        <div class="card"><div class="metriclabel">Ingresos totales</div><div class="metric">${moneda(suma(() => true))}</div></div>
        <div class="card"><div class="metriclabel">Efectivo</div><div class="metric">${moneda(suma(v => v.metodo === 'Efectivo'))}</div></div>
        <div class="card"><div class="metriclabel">Transferencia</div><div class="metric">${moneda(suma(v => v.metodo === 'Transferencia'))}</div></div>
        <div class="card"><div class="metriclabel">Tarjeta</div><div class="metric">${moneda(suma(v => v.metodo === 'Tarjeta'))}</div></div>
      </div>

      <div class="card"><div class="row between"><h2 style="margin:0">Ventas</h2>
        <input id="buscarVenta" placeholder="Buscar por folio o referencia…" value="${esc(busqueda)}" style="min-width:260px"></div>
        <div class="tablewrap"><table><thead><tr><th>Folio</th><th>Fecha</th><th>Usuario</th><th>Pago</th><th>Referencia</th><th>Total</th><th></th></tr></thead><tbody>
        ${ventas.map(v => `<tr class="${v.estado !== 'vigente' ? 'cancelled' : ''}"><td>${marca[v.folio] ? `<span title="${marca[v.folio] === '⚠' ? 'Posible duplicado por revisar' : 'Posible duplicado ya revisado'}">${marca[v.folio]}</span> ` : ''}${v.folio}</td><td>${fechaHora(v.fecha)}</td><td>${esc(v.usuario)}</td><td>${v.metodo}</td><td>${esc(v.referencia) || '—'}</td><td>${moneda(v.total)}</td><td><button class="sm" data-folio="${v.folio}">Ver</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No hay ventas en este periodo.</td></tr>'}
      </tbody></table></div></div>

      <div class="card" style="margin-top:14px"><h2>Productos más vendidos</h2><div class="tablewrap"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Importe</th></tr></thead><tbody>
        ${top.map(t => `<tr><td>${esc(t.nombre)}</td><td>${formatoCant(t.cantidad)} ${t.unidad}</td><td>${moneda(t.importe)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sin datos.</td></tr>'}
      </tbody></table></div></div>

      <div class="card" style="margin-top:14px"><h2>Cortes de caja y diferencias</h2><div class="tablewrap"><table><thead><tr><th>Apertura</th><th>Cierre</th><th>Usuario</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Notas</th></tr></thead><tbody>
        ${cortes.map(s => `<tr><td>${fechaHora(s.abiertaEn)}</td><td>${fechaHora(s.cerradaEn)}</td><td>${esc(s.cerradaPor)}</td><td>${moneda(s.efectivoEsperado)}</td><td>${moneda(s.efectivoContado)}</td><td><b style="color:${colorDif(s.diferencia)}">${moneda(s.diferencia)}</b></td><td>${esc(s.notas)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No hay cortes en este periodo.</td></tr>'}
      </tbody></table></div></div>

      <div class="card" style="margin-top:14px"><h2>Movimientos de inventario</h2><div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Cantidad</th><th>Detalle</th><th>Usuario</th></tr></thead><tbody>
        ${movimientos.map(m => `<tr><td>${fechaHora(m.fecha)}</td><td>${m.tipo}</td><td>${esc(m.producto)}</td><td>${m.cantidad > 0 ? '+' : ''}${formatoCant(m.cantidad)} ${m.unidad}</td><td>${esc(m.nota)}</td><td>${esc(m.usuario)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sin movimientos.</td></tr>'}
      </tbody></table></div></div>`;

    $('periodo').value = periodo;
    $('periodo').onchange = e => { periodo = e.target.value; mostrar(vista); };
    // La búsqueda vuelve a pintar la pantalla; se conserva el cursor en el campo
    vista.oninput = e => {
      if (e.target.id !== 'buscarVenta') return;
      busqueda = e.target.value; mostrar(vista);
      const campo = $('buscarVenta'); campo.focus(); campo.setSelectionRange(busqueda.length, busqueda.length);
    };
    vista.onclick = e => {
      if (e.target.closest('#btnExportar')) return descargarCSV('ventas_abarrotes_gema.csv',
        [['Folio', 'Fecha', 'Usuario', 'Pago', 'Referencia', 'Estado', 'Subtotal', 'Descuento', 'Total'],
         ...Almacen.ventas.todas().map(v => [v.folio, fechaHora(v.fecha), v.usuario, v.metodo, v.referencia || '', v.estado === 'vigente' ? 'Vigente' : 'Cancelada', subtotalDe(v), v.descuento || 0, v.total])]);
      const r = e.target.closest('[data-revisar]'); if (r) return revisar(r.dataset.revisar.split(','));
      const b = e.target.closest('[data-folio]'); if (b) detalleVenta(b.dataset.folio);
    };
  }

  function revisar(folios) {
    abrirVentana('Marcar como revisado', `<p style="margin-top:0">Ventas: <b>${folios.join(', ')}</b></p>
      <label class="muted" for="notaRevision">Nota (opcional)</label>
      <input id="notaRevision" style="width:100%;margin-top:6px" placeholder="Ej. Verificado en Mercado Pago: son 2 operaciones distintas">`,
      [{ texto: 'Cancelar' }, { texto: 'Marcar revisado', clase: 'primary', alPulsar: () => {
        Almacen.ventas.marcarRevisado(folios, $('notaRevision').value, App.usuario.nombre);
        aviso('Alerta marcada como revisada.'); mostrar($('vista')); App.actualizarEstado();
      } }]);
  }

  function detalleVenta(folio) {
    const v = Almacen.ventas.porFolio(folio);
    const cuerpo = `<div class="muted">${fechaHora(v.fecha)} · ${esc(v.usuario)} · ${v.metodo}${v.estado !== 'vigente' ? ' · <b style="color:var(--red)">CANCELADA</b>' : ''}</div>
      ${v.referencia ? `<div class="note" style="margin-top:10px"><b>Referencia (${v.metodo === 'Tarjeta' ? 'últimos 4 dígitos de la operación de la terminal' : 'folio de la transferencia'}):</b> ${esc(v.referencia)}</div>` : ''}
      <div class="tablewrap"><table><thead><tr><th>Producto</th><th>Cant.</th><th>Importe</th></tr></thead><tbody>
      ${v.partidas.map(i => `<tr><td>${esc(i.nombre)}</td><td>${formatoCant(i.cantidad)} ${i.unidad}</td><td>${moneda(i.importe)}</td></tr>`).join('')}</tbody></table></div>
      ${v.descuento ? `<div class="summaryline"><span>Subtotal</span><b>${moneda(subtotalDe(v))}</b></div><div class="summaryline"><span>Descuento</span><b>-${moneda(v.descuento)}</b></div>` : ''}
      <div class="summaryline big"><span>Total</span><span>${moneda(v.total)}</span></div>
      ${v.revision ? `<div class="note" style="margin-top:10px">✓ Alerta de posible duplicado revisada por <b>${esc(v.revision.por)}</b> el ${fechaHora(v.revision.fecha)}${v.revision.nota ? ': ' + esc(v.revision.nota) : ''}</div>` : ''}`;
    const botones = [{ texto: 'Cerrar' }];
    if (v.estado === 'vigente') botones.unshift({ texto: 'Cancelar venta', clase: 'danger', alPulsar: () => {
      setTimeout(async () => {
        if (!(await pedirConfirmacion('Cancelar venta ' + folio, 'Se regresarán los productos al inventario y la venta dejará de contar en los totales. Si el corte de caja de ese día ya se cerró, no se modificará.', 'Sí, cancelar', true))) return;
        try { Almacen.ventas.cancelar(folio, App.usuario.nombre); aviso('Venta cancelada.'); mostrar($('vista')); App.actualizarEstado(); }
        catch (e) { aviso(e.message, true); }
      }, 50);
    } });
    abrirVentana('Venta ' + folio, cuerpo, botones);
  }
})();
