/* modulos/caja/caja.datos.js · Reglas de apertura y cierre de caja */
Almacen.registrar('caja', ({ bd, guardar, util }) => {
  const actual = () => bd.sesiones.find(s => !s.cerradaEn) || null;

  function abrir(fondoInicial, usuario) {
    if (actual()) throw new Error('Ya hay una caja abierta.');
    fondoInicial = util.dinero(fondoInicial);
    if (!(fondoInicial >= 0)) throw new Error('El cambio inicial no es válido.');
    const s = { id: bd.contadores.sesion++, abiertaEn: util.ahora(), abiertaPor: usuario, fondoInicial,
                cerradaEn: null, cerradaPor: null, efectivoContado: null, efectivoEsperado: null, diferencia: null,
                ventasEfectivo: 0, ventasTarjeta: 0, ventasTransferencia: 0, notas: '', sincronizado: false };
    bd.sesiones.unshift(s);
    guardar();
    return s;
  }

  // Solo el efectivo entra al cajón; tarjeta y transferencia se muestran aparte.
  function totales(sesion) {
    const ventas = bd.ventas.filter(v => v.sesionId === sesion.id && v.estado === 'vigente');
    const por = metodo => util.dinero(ventas.filter(v => v.metodo === metodo).reduce((a, v) => a + v.total, 0));
    const efectivo = por('Efectivo');
    return { cantidad: ventas.length, efectivo, tarjeta: por('Tarjeta'), transferencia: por('Transferencia'),
             esperado: util.dinero(sesion.fondoInicial + efectivo) };
  }

  function cerrar(efectivoContado, notas, usuario) {
    const s = actual();
    if (!s) throw new Error('No hay caja abierta.');
    efectivoContado = util.dinero(efectivoContado);
    if (!(efectivoContado >= 0)) throw new Error('Escribe el efectivo contado.');
    const t = totales(s);
    Object.assign(s, { cerradaEn: util.ahora(), cerradaPor: usuario, efectivoContado, efectivoEsperado: t.esperado,
                       ventasEfectivo: t.efectivo, ventasTarjeta: t.tarjeta, ventasTransferencia: t.transferencia,
                       diferencia: util.dinero(efectivoContado - t.esperado), notas: notas || '', sincronizado: false });
    guardar();
    return s;
  }

  return { actual, abrir, totales, cerrar, historial: () => bd.sesiones.filter(s => s.cerradaEn) };
});
