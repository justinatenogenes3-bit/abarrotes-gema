/* modules/inventory/inventory.data.js · Reglas de productos y existencias */
Store.register('inventory', ({ db, persist, h }) => {
  const product = id => db.products.find(p => p.id === id);

  function findByCode(code) {
    code = String(code || '').trim();
    return code ? db.products.find(p => p.code === code) || null : null;
  }

  function search(q) {
    q = String(q || '').trim().toLowerCase();
    const list = q ? db.products.filter(p => (p.name + ' ' + p.code).toLowerCase().includes(q)) : db.products.slice();
    return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  // Registro de movimientos (lo usan inventario y ventas)
  function logMove(m) {
    db.movements.unshift({
      id: db.counters.move++, at: m.at || h.nowISO(), type: m.type,
      productId: m.productId, product: m.product, qty: h.r3(m.qty), unit: m.unit,
      note: m.note || '', userName: m.userName || '', synced: false
    });
  }

  function save(data, id) {
    const clean = {
      name: String(data.name || '').trim(),
      code: String(data.code || '').trim(),
      price: h.r2(data.price),
      stock: h.r3(data.stock),
      unit: data.unit || 'PZ',
      low: Number(data.low) || 0
    };
    if (!clean.name) throw new Error('Escribe el nombre del producto.');
    if (!(clean.price >= 0)) throw new Error('El precio no es válido.');
    if (!(clean.stock >= 0)) throw new Error('La existencia no es válida.');
    if (clean.code && db.products.some(p => p.code === clean.code && p.id !== id)) throw new Error('Ese código de barras ya existe.');
    if (id) {
      const p = product(id);
      const diff = h.r3(clean.stock - p.stock);
      Object.assign(p, clean);
      if (diff !== 0) logMove({ type: 'Ajuste', productId: p.id, product: p.name, qty: diff, unit: p.unit, note: 'Edición de producto', userName: data.userName });
    } else {
      const p = Object.assign({ id: h.nextId(db.products) }, clean);
      db.products.push(p);
      if (p.stock > 0) logMove({ type: 'Entrada', productId: p.id, product: p.name, qty: p.stock, unit: p.unit, note: 'Existencia inicial', userName: data.userName });
    }
    persist();
  }

  // delta positivo = entrada, negativo = merma/salida
  function adjust(id, delta, type, note, userName) {
    const p = product(id);
    if (!p) throw new Error('Producto no encontrado.');
    delta = h.r3(delta);
    if (!delta) throw new Error('La cantidad no es válida.');
    if (p.stock + delta < 0) throw new Error('La cantidad supera la existencia (' + p.stock + ' ' + p.unit + ').');
    p.stock = h.r3(p.stock + delta);
    logMove({ type, productId: p.id, product: p.name, qty: delta, unit: p.unit, note, userName });
    persist();
  }

  return { product, findByCode, search, save, adjust, logMove, all: () => db.products };
});
