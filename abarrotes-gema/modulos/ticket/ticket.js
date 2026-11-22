/* modulos/ticket/ticket.js · Ticket de venta para impresora térmica (58 u 80 mm)
   - Botón «Imprimir ticket» al cobrar y «Reimprimir» en Reportes (sin modificar esos módulos).
   - Pantalla «Ticket» (administrador): datos de la tienda y vista previa.
   Reglas y datos: modulos/ticket/ticket.datos.js */
(function () {
  'use strict';
  const { $, esc, aviso } = App;

  const ABREV = { Efectivo: 'EFE', Tarjeta: 'TAR', Transferencia: 'TRANSF' };
  const dosd = n => String(n).padStart(2, '0');
  const dinero = n => '$' + Number(n || 0).toFixed(2);
  const cantidad = p => Number(p.cantidad).toFixed(p.unidad === 'PZ' ? 2 : 3);

  /* ---------- Diseño del ticket (HTML listo para imprimir) ---------- */
  function html(v, opciones) {
    const c = Ticket.config(), copia = opciones && opciones.copia, f = new Date(v.fecha);
    const fecha = `${dosd(f.getDate())}-${dosd(f.getMonth() + 1)}-${f.getFullYear()}`, hora = `${dosd(f.getHours())}:${dosd(f.getMinutes())}:${dosd(f.getSeconds())}`;
    const articulos = v.partidas.reduce((a, p) => a + Number(p.cantidad), 0);
    const filas = v.partidas.map(p => `<tr><td class="cant">${cantidad(p)}</td><td>${esc(p.nombre)}${p.unidad !== 'PZ' ? ' (' + p.unidad + ')' : ''}</td><td class="num">${Number(p.precio).toFixed(2)}</td><td class="num">${Number(p.importe).toFixed(2)}</td></tr>`).join('');
    const linea = (a, b, fuerte) => `<div class="par${fuerte ? ' fuerte' : ''}"><span>${a}</span><span>${b}</span></div>`;
    const cuerpo = `
      <div class="centro fuerte">* ${esc(c.nombre.toUpperCase())} *</div>
      ${c.direccion ? `<div class="centro">${esc(c.direccion.toUpperCase())}</div>` : ''}
      ${c.colonia ? `<div class="centro">${esc(c.colonia.toUpperCase())}</div>` : ''}
      ${c.telefono ? `<div class="centro">TEL. ${esc(c.telefono)}</div>` : ''}
      ${c.aviso ? `<div class="centro sep">${esc(c.aviso)}</div>` : ''}
      ${copia ? '<div class="centro fuerte">*** COPIA ***</div>' : ''}
      ${linea('Ticket: ' + esc(v.folio), '')}
      ${linea(fecha, 'Hora: ' + hora)}
      <div>Atendió: ${esc(v.usuario)}</div>
      <div>Cliente de mostrador</div>
      <table><thead><tr><th class="cant">CANT</th><th>DESCRIPCION</th><th class="num">P/U</th><th class="num">IMPORTE</th></tr></thead><tbody>${filas}</tbody></table>
      <div class="linea"></div>
      ${v.descuento ? linea('Subtotal', dinero(v.subtotal)) + linea('Descuento', '-' + dinero(v.descuento)) : ''}
      ${linea(Number(articulos.toFixed(3)).toFixed(2) + ' ---- TOTALES ---', dinero(v.total), true)}
      ${linea('Pago en ' + (ABREV[v.metodo] || esc(v.metodo)), dinero(v.metodo === 'Efectivo' ? v.recibido : v.total))}
      ${v.referencia ? linea('Referencia:', esc(v.referencia)) : ''}
      ${v.metodo === 'Efectivo' ? linea('Cambio:', dinero(v.cambio), true) : ''}
      <div class="centro sep">${esc(Ticket.importeConLetra(v.total))}</div>
      ${c.despedida ? `<div class="centro sep">${esc(c.despedida)}</div>` : ''}
      ${c.pie1 ? `<div class="centro">${esc(c.pie1)}</div>` : ''}
      ${c.pie2 ? `<div class="centro">${esc(c.pie2)}</div>` : ''}`;
    const chico = c.ancho === 58;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${esc(v.folio)}</title><style>
      @page{size:${c.ancho}mm auto;margin:0}
      *{box-sizing:border-box}
      body{margin:0;padding:3mm;width:${c.ancho}mm;font-family:'Courier New',Courier,monospace;font-size:${chico ? 10 : 12}px;line-height:1.35;color:#000;background:#fff}
      .centro{text-align:center}.fuerte{font-weight:700}.sep{margin:6px 0}
      .par{display:flex;justify-content:space-between;gap:6px}
      .linea{border-top:1px dashed #000;margin:4px 0}
      table{width:100%;border-collapse:collapse;margin-top:4px}
      th,td{padding:1px 2px;vertical-align:top;text-align:left;font-weight:inherit}
      th{border-bottom:1px dashed #000}
      .cant{width:${chico ? 34 : 44}px}.num{text-align:right;white-space:nowrap}
    </style></head><body>${cuerpo}</body></html>`;
  }

  function imprimir(v, opciones) {
    const marco = document.createElement('iframe');
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(marco);
    marco.onload = () => {
      try { marco.contentWindow.focus(); marco.contentWindow.print(); }
      catch (e) { aviso('No se pudo abrir la impresión.', true); }
      setTimeout(() => marco.remove(), 3000);
    };
    marco.srcdoc = html(v, opciones);
  }

  /* ---------- Botones en Ventas (al cobrar) y Reportes (detalle) ---------- */
  const abrirVentanaOriginal = App.abrirVentana;
  App.abrirVentana = function (titulo, cuerpo, botones, alDescartar) {
    botones = botones || [];
    if (titulo === '✅ Venta registrada') {
      const v = Almacen.ventas.todas()[0];
      if (v) {
        botones = [{ texto: '🖨️ Imprimir ticket', alPulsar: () => { imprimir(v); return false; } }, ...botones];
        if (Ticket.config().imprimirAuto) setTimeout(() => imprimir(v), 200);
      }
    } else if (/^Venta G-/.test(titulo)) {
      const v = Almacen.ventas.porFolio(titulo.slice(6));
      if (v) botones = [{ texto: '🖨️ Reimprimir ticket', alPulsar: () => { imprimir(v, { copia: true }); return false; } }, ...botones];
    }
    return abrirVentanaOriginal(titulo, cuerpo, botones, alDescartar);
  };

  /* ---------- Pantalla «Ticket» (administrador) ---------- */
  App.registrar({ id: 'ticket', orden: 7, icono: '🧾', etiqueta: 'Ticket', roles: ['Administrador'], mostrar });

  function ventaDeMuestra() {
    return Almacen.ventas.todas()[0] || {
      folio: 'G-00000', fecha: new Date().toISOString(), usuario: App.usuario.nombre, metodo: 'Efectivo', referencia: '',
      subtotal: 66, descuento: 0, total: 66, recibido: 100, cambio: 34,
      partidas: [
        { nombre: 'Galletas 25 GR CHOCOLATE', unidad: 'PZ', precio: 18, cantidad: 2, importe: 36 },
        { nombre: 'Huevo', unidad: 'KG', precio: 45, cantidad: 0.667, importe: 30 }]
    };
  }

  function mostrar(vista) {
    const c = Ticket.config(), tienda = Tiendas.activa();
    const campo = (id, etiqueta, valor, ancho) => `<label class="${ancho || ''}">${etiqueta}<input id="${id}" value="${esc(valor)}"></label>`;
    vista.innerHTML = `
      <div class="heading"><div><h1>🧾 Ticket · ${esc(tienda.nombre)}</h1><div class="muted">Datos que se imprimen en el ticket de esta tienda. Cada tienda tiene el suyo.</div></div></div>
      <div class="cards2">
        <div class="card"><div class="formgrid">
          ${campo('tNombre', 'Nombre de la tienda', c.nombre, 'wide')}
          ${campo('tDireccion', 'Calle y número', c.direccion, 'wide')}
          ${campo('tColonia', 'Colonia y ciudad', c.colonia, 'wide')}
          ${campo('tTelefono', 'Teléfono', c.telefono)}
          <label>Ancho del papel<select id="tAncho"><option value="80" ${c.ancho === 80 ? 'selected' : ''}>80 mm</option><option value="58" ${c.ancho === 58 ? 'selected' : ''}>58 mm</option></select></label>
          ${campo('tAviso', 'Aviso fiscal', c.aviso, 'wide')}
          ${campo('tDespedida', 'Despedida', c.despedida, 'wide')}
          ${campo('tPie1', 'Nota 1', c.pie1, 'wide')}
          ${campo('tPie2', 'Nota 2', c.pie2, 'wide')}
          <label class="wide" style="flex-direction:row;align-items:center;gap:10px"><input id="tAuto" type="checkbox" ${c.imprimirAuto ? 'checked' : ''} style="min-height:auto;width:auto"> Imprimir el ticket automáticamente al cobrar</label>
        </div>
        <div class="row" style="margin-top:14px"><button class="primary" id="btnGuardarTicket">Guardar</button><button id="btnPruebaTicket">Imprimir prueba</button></div></div>
        <div class="card"><h2>Vista previa</h2><iframe id="vistaTicket" title="Vista previa del ticket" style="width:100%;height:560px;border:1px solid var(--line);border-radius:10px;background:#fff"></iframe></div>
      </div>`;
    const leer = () => ({ nombre: $('tNombre').value.trim() || tienda.nombre, direccion: $('tDireccion').value.trim(), colonia: $('tColonia').value.trim(),
      telefono: $('tTelefono').value.trim(), ancho: Number($('tAncho').value), aviso: $('tAviso').value.trim(), despedida: $('tDespedida').value.trim(),
      pie1: $('tPie1').value.trim(), pie2: $('tPie2').value.trim(), imprimirAuto: $('tAuto').checked });
    const previa = () => { Ticket.guardarConfig(leer()); $('vistaTicket').srcdoc = html(ventaDeMuestra()); };   // se guarda al escribir
    previa();
    vista.oninput = vista.onchange = previa;
    vista.onclick = e => {
      if (e.target.closest('#btnGuardarTicket')) { previa(); aviso('Ticket guardado para ' + tienda.nombre + '.'); }
      else if (e.target.closest('#btnPruebaTicket')) { previa(); imprimir(ventaDeMuestra()); }
    };
  }
})();
