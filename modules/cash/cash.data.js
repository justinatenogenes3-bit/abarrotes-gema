/* modules/cash/cash.data.js · Reglas de apertura y cierre de caja */
Store.register('cash', ({ db, persist, h }) => {
  const current = () => db.sessions.find(s => !s.closedAt) || null;

  function open(openingCash, userName) {
    if (current()) throw new Error('Ya hay una caja abierta.');
    openingCash = h.r2(openingCash);
    if (!(openingCash >= 0)) throw new Error('El cambio inicial no es válido.');
    const s = { id: db.counters.session++, openedAt: h.nowISO(), openedBy: userName, openingCash,
                closedAt: null, closedBy: null, countedCash: null, expectedCash: null, diff: null,
                cashSales: 0, cardSales: 0, transferSales: 0, notes: '', synced: false };
    db.sessions.unshift(s);
    persist();
    return s;
  }

  // Solo el efectivo entra al cajón; tarjeta y transferencia se muestran aparte.
  function totals(s) {
    const sales = db.sales.filter(x => x.sessionId === s.id && x.status === 'ok');
    const by = m => h.r2(sales.filter(x => x.method === m).reduce((a, x) => a + x.total, 0));
    const cash = by('Efectivo');
    return { count: sales.length, cash, card: by('Tarjeta'), transfer: by('Transferencia'), expected: h.r2(s.openingCash + cash) };
  }

  function close(countedCash, notes, userName) {
    const s = current();
    if (!s) throw new Error('No hay caja abierta.');
    countedCash = h.r2(countedCash);
    if (!(countedCash >= 0)) throw new Error('Escribe el efectivo contado.');
    const t = totals(s);
    Object.assign(s, { closedAt: h.nowISO(), closedBy: userName, countedCash, expectedCash: t.expected,
                       cashSales: t.cash, cardSales: t.card, transferSales: t.transfer,
                       diff: h.r2(countedCash - t.expected), notes: notes || '', synced: false });
    persist();
    return s;
  }

  return { current, open, totals, close, history: () => db.sessions.filter(x => x.closedAt) };
});
