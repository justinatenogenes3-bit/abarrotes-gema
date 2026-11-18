/* modulos/inventario/inventario.datos.js · Reglas de productos y existencias */
Almacen.registrar('inventario', ({ bd, guardar, util }) => {
  const producto = id => bd.productos.find(p => p.id === id);

  function buscarPorCodigo(codigo) {
    codigo = String(codigo || '').trim();
    return codigo ? bd.productos.find(p => p.codigo === codigo) || null : null;
  }

  function buscar(texto) {
    texto = String(texto || '').trim().toLowerCase();
    const lista = texto ? bd.productos.filter(p => (p.nombre + ' ' + p.codigo).toLowerCase().includes(texto)) : bd.productos.slice();
    return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  // Registro de movimientos (lo usan inventario y ventas)
  function registrarMovimiento(m) {
    bd.movimientos.unshift({
      id: bd.contadores.movimiento++, fecha: m.fecha || util.ahora(), tipo: m.tipo,
      productoId: m.productoId, producto: m.producto, cantidad: util.kilos(m.cantidad), unidad: m.unidad,
      nota: m.nota || '', usuario: m.usuario || '', sincronizado: false
    });
  }

  function guardarProducto(datos, id) {
    const limpio = {
      nombre: String(datos.nombre || '').trim(),
      codigo: String(datos.codigo || '').trim(),
      precio: util.dinero(datos.precio),
      existencia: util.kilos(datos.existencia),
      unidad: datos.unidad || 'PZ',
      minimo: Number(datos.minimo) || 0
    };
    if (!limpio.nombre) throw new Error('Escribe el nombre del producto.');
    if (!(limpio.precio >= 0)) throw new Error('El precio no es válido.');
    if (!(limpio.existencia >= 0)) throw new Error('La existencia no es válida.');
    if (limpio.codigo && bd.productos.some(p => p.codigo === limpio.codigo && p.id !== id)) throw new Error('Ese código de barras ya existe.');
    if (id) {
      const p = producto(id);
      const dif = util.kilos(limpio.existencia - p.existencia);
      Object.assign(p, limpio);
      if (dif !== 0) registrarMovimiento({ tipo: 'Ajuste', productoId: p.id, producto: p.nombre, cantidad: dif, unidad: p.unidad, nota: 'Edición de producto', usuario: datos.usuario });
    } else {
      const p = Object.assign({ id: util.siguienteId(bd.productos) }, limpio);
      bd.productos.push(p);
      if (p.existencia > 0) registrarMovimiento({ tipo: 'Entrada', productoId: p.id, producto: p.nombre, cantidad: p.existencia, unidad: p.unidad, nota: 'Existencia inicial', usuario: datos.usuario });
    }
    guardar();
  }

  // cambio positivo = entrada, negativo = merma/salida
  function ajustar(id, cambio, tipo, nota, usuario) {
    const p = producto(id);
    if (!p) throw new Error('Producto no encontrado.');
    cambio = util.kilos(cambio);
    if (!cambio) throw new Error('La cantidad no es válida.');
    if (p.existencia + cambio < 0) throw new Error('La cantidad supera la existencia (' + p.existencia + ' ' + p.unidad + ').');
    p.existencia = util.kilos(p.existencia + cambio);
    registrarMovimiento({ tipo, productoId: p.id, producto: p.nombre, cantidad: cambio, unidad: p.unidad, nota, usuario });
    guardar();
  }

  return { producto, buscarPorCodigo, buscar, guardarProducto, ajustar, registrarMovimiento, todos: () => bd.productos };
});
