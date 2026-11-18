/* modulos/ventas/ventas.datos.js · Reglas de ventas (usa inventario y caja) */
Almacen.registrar('ventas', ({ bd, guardar, util }, almacen) => {
  const METODOS = ['Efectivo', 'Transferencia', 'Tarjeta'];

  // Referencia obligatoria para poder rastrear los cobros que no son en efectivo.
  //  - Tarjeta: últimos 4 dígitos de «Operación #» del ticket de la terminal (NO los de la tarjeta).
  //    Para ubicarla se usa: fecha y hora + monto + estos 4 dígitos.
  //  - Transferencia: folio / clave de rastreo completo del comprobante.
  const REFERENCIAS = {
    Tarjeta: {
      etiqueta: 'Últimos 4 dígitos de la operación (ticket de la terminal)',
      ayuda: 'Escribe los últimos 4 números de «Operación #» del ticket. No son los de la tarjeta.',
      pedir: 'los últimos 4 dígitos de la operación del ticket de la terminal',
      soloNumeros: true, maxLargo: 4, patron: /^\d{4}$/, formato: 'escribe exactamente 4 números'
    },
    Transferencia: {
      etiqueta: 'Folio de la operación',
      ayuda: 'Escribe el folio o clave de rastreo que aparece en el comprobante de la transferencia.',
      pedir: 'el folio de la operación',
      soloNumeros: false, maxLargo: 40, patron: /^[A-Z0-9]{4,40}$/, formato: 'letras y números, sin espacios (de 4 a 40 caracteres)'
    }
  };
  const reglaReferencia = metodo => REFERENCIAS[metodo] || null;

  function errorReferencia(mensaje) { const e = new Error(mensaje); e.campo = 'referencia'; return e; }

  function validarReferencia(metodo, referencia) {
    const regla = REFERENCIAS[metodo];
    if (!regla) return null;                                   // efectivo: no lleva referencia
    const ref = String(referencia || '').replace(/\s+/g, '').toUpperCase();
    if (!ref) throw errorReferencia('Captura ' + regla.pedir + ' antes de cobrar.');
    if (!regla.patron.test(ref)) throw errorReferencia('La referencia no es válida: ' + regla.formato + '.');
    // El folio de una transferencia es único: repetirlo es casi seguro un error, se rechaza.
    // En tarjeta NO se bloquea (4 dígitos pueden coincidir de verdad): se avisa al administrador,
    // ver duplicadosTarjeta().
    if (metodo === 'Transferencia') {
      const repetida = bd.ventas.find(v => v.estado === 'vigente' && v.metodo === metodo && v.referencia === ref);
      if (repetida) throw errorReferencia('Ese folio ya se usó en la venta ' + repetida.folio + '. Revisa el comprobante.');
    }
    return ref;
  }

  /* ---------- Alertas para el administrador ----------
     Posible duplicado = cobros con tarjeta vigentes con los mismos 4 dígitos Y el mismo monto
     el mismo día. El cajero no ve nada; el administrador lo revisa contra el reporte de la terminal. */
  function duplicadosTarjeta() {
    const grupos = {};
    bd.ventas.forEach(v => {
      if (v.estado !== 'vigente' || v.metodo !== 'Tarjeta' || !v.referencia) return;
      const clave = v.referencia + '|' + v.total + '|' + new Date(v.fecha).toDateString();
      (grupos[clave] = grupos[clave] || []).push(v);
    });
    return Object.values(grupos).filter(g => g.length > 1).map(g => {
      const ventas = g.slice().sort((x, y) => (x.fecha < y.fecha ? -1 : 1));
      return { referencia: ventas[0].referencia, total: ventas[0].total, ventas, pendiente: ventas.some(v => !v.revision) };
    }).sort((x, y) => (x.ventas[0].fecha < y.ventas[0].fecha ? 1 : -1));
  }
  const alertasPendientes = () => duplicadosTarjeta().filter(g => g.pendiente);

  function marcarRevisado(folios, nota, usuario) {
    folios.forEach(f => {
      const v = bd.ventas.find(x => x.folio === f);
      if (v) { v.revision = { por: usuario, fecha: util.ahora(), nota: String(nota || '').trim() }; v.sincronizado = false; }
    });
    guardar();
  }

  // partidas: [{id, codigo, nombre, unidad, precio, cantidad}]
  function agregar({ partidas, metodo, recibido, descuento, referencia, usuario }) {
    const sesion = almacen.caja.actual();
    if (!sesion) throw new Error('Abre la caja antes de vender.');
    if (!partidas.length) throw new Error('Agrega al menos un producto.');
    if (!METODOS.includes(metodo)) throw new Error('Método de pago no válido.');
    for (const i of partidas) {
      const p = almacen.inventario.producto(i.id);
      if (!p) throw new Error('El producto "' + i.nombre + '" ya no existe.');
      if (i.cantidad > p.existencia + 1e-9) throw new Error('Existencia insuficiente de "' + p.nombre + '" (hay ' + p.existencia + ' ' + p.unidad + ').');
    }
    const lineas = partidas.map(i => ({ id: i.id, codigo: i.codigo, nombre: i.nombre, unidad: i.unidad,
                                        precio: i.precio, cantidad: util.kilos(i.cantidad), importe: util.dinero(i.precio * i.cantidad) }));
    const subtotal = util.dinero(lineas.reduce((a, l) => a + l.importe, 0));
    descuento = util.dinero(descuento || 0);
    if (!(descuento >= 0) || descuento > subtotal) throw new Error('El descuento no es válido.');
    const total = util.dinero(subtotal - descuento);

    let cambio = 0;
    if (metodo === 'Efectivo') {
      recibido = util.dinero(recibido);
      if (!(recibido >= total)) throw new Error('El efectivo recibido es menor al total.');
      cambio = util.dinero(recibido - total);
    } else { recibido = null; }
    const ref = validarReferencia(metodo, referencia);

    const folio = 'G-' + String(bd.contadores.venta++).padStart(5, '0');
    const fecha = util.ahora();
    lineas.forEach(l => {
      const p = almacen.inventario.producto(l.id);
      p.existencia = util.kilos(p.existencia - l.cantidad);
      almacen.inventario.registrarMovimiento({ fecha, tipo: 'Venta', productoId: p.id, producto: p.nombre, cantidad: -l.cantidad, unidad: p.unidad, nota: folio, usuario });
    });
    const venta = { folio, fecha, usuario, metodo, referencia: ref, subtotal, descuento, total, recibido, cambio,
                    sesionId: sesion.id, estado: 'vigente', partidas: lineas, sincronizado: false };
    bd.ventas.unshift(venta);
    guardar();
    return venta;
  }

  function cancelar(folio, usuario) {
    const venta = bd.ventas.find(v => v.folio === folio);
    if (!venta) throw new Error('Venta no encontrada.');
    if (venta.estado !== 'vigente') throw new Error('La venta ya estaba cancelada.');
    venta.partidas.forEach(l => {
      const p = almacen.inventario.producto(l.id);
      if (p) {
        p.existencia = util.kilos(p.existencia + l.cantidad);
        almacen.inventario.registrarMovimiento({ tipo: 'Cancelación', productoId: p.id, producto: p.nombre, cantidad: l.cantidad, unidad: p.unidad, nota: folio, usuario });
      }
    });
    Object.assign(venta, { estado: 'cancelada', canceladaEn: util.ahora(), canceladaPor: usuario, sincronizado: false });
    guardar();
  }

  return { METODOS, reglaReferencia, agregar, cancelar, duplicadosTarjeta, alertasPendientes, marcarRevisado, todas: () => bd.ventas, porFolio: f => bd.ventas.find(v => v.folio === f) };
});
