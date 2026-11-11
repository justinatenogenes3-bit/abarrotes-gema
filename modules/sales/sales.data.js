/* modules/sales/sales.data.js · Reglas de ventas (usa inventario y caja) */
Store.register('sales', ({ db, persist, h }, S) => {
  const METHODS = ['Efectivo', 'Transferencia', 'Tarjeta'];

  function add({ items, method, received, discount, userName }) {
    const session = S.cash.current();
    if (!session) throw new Error('Abre la caja antes de vender.');
    if (!items.length) throw new Error('Agrega al menos un producto.');
    if (!METHODS.includes(method)) throw new Error('Método de pago no válido.');
    for (const i of items) {
      const p = S.inventory.product(i.id);
      if (!p) throw new Error('El producto "' + i.name + '" ya no existe.');
      if (i.qty > p.stock + 1e-9) throw new Error('Existencia insuficiente de "' + p.name + '" (hay ' + p.stock + ' ' + p.unit + ').');
    }
    const lines = items.map(i => ({ id: i.id, code: i.code, name: i.name, unit: i.unit,
                                    price: i.price, qty: h.r3(i.qty), subtotal: h.r2(i.price * i.qty) }));
    const subtotal = h.r2(lines.reduce((a, l) => a + l.subtotal, 0));
    discount = h.r2(discount || 0);
    if (!(discount >= 0) || discount > subtotal) throw new Error('El descuento no es válido.');
    const total = h.r2(subtotal - discount);

    let change = 0;
    if (method === 'Efectivo') {
      received = h.r2(received);
      if (!(received >= total)) throw new Error('El efectivo recibido es menor al total.');
      change = h.r2(received - total);
    } else { received = null; }

    const folio = 'G-' + String(db.counters.sale++).padStart(5, '0');
    const at = h.nowISO();
    lines.forEach(l => {
      const p = S.inventory.product(l.id);
      p.stock = h.r3(p.stock - l.qty);
      S.inventory.logMove({ at, type: 'Venta', productId: p.id, product: p.name, qty: -l.qty, unit: p.unit, note: folio, userName });
    });
    const sale = { folio, at, userName, method, subtotal, discount, total, received, change,
                   sessionId: session.id, status: 'ok', items: lines, synced: false };
    db.sales.unshift(sale);
    persist();
    return sale;
  }

  function cancel(folio, userName) {
    const sale = db.sales.find(s => s.folio === folio);
    if (!sale) throw new Error('Venta no encontrada.');
    if (sale.status !== 'ok') throw new Error('La venta ya estaba cancelada.');
    sale.items.forEach(l => {
      const p = S.inventory.product(l.id);
      if (p) {
        p.stock = h.r3(p.stock + l.qty);
        S.inventory.logMove({ type: 'Cancelación', productId: p.id, product: p.name, qty: l.qty, unit: p.unit, note: folio, userName });
      }
    });
    Object.assign(sale, { status: 'cancelled', cancelledAt: h.nowISO(), cancelledBy: userName, synced: false });
    persist();
  }

  return { METHODS, add, cancel, all: () => db.sales, byFolio: f => db.sales.find(s => s.folio === f) };
});
