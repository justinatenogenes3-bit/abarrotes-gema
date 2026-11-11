/* =====================================================================
   core/store.js · Núcleo de datos
   ---------------------------------------------------------------------
   Aquí vive SOLO lo común: cargar/guardar, respaldo y datos de ejemplo.
   Las reglas de cada módulo están en su carpeta (modules/xxx/xxx.data.js)
   y se conectan con Store.register('nombre', ...).

   HOY: guarda en localStorage. PASO 2: aquí se conectará Firebase.
   Cada registro lleva "synced:false" para saber qué falta subir a la nube.
   ===================================================================== */
const Store = (function () {
  'use strict';

  const KEY = 'gemaPOS_v2';
  let db = null;

  const h = {
    nowISO: () => new Date().toISOString(),
    r2: n => Math.round((Number(n) + Number.EPSILON) * 100) / 100,    // dinero
    r3: n => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000,  // kilos
    nextId: arr => Math.max(0, ...arr.map(x => x.id)) + 1
  };

  /* ---------- Datos de ejemplo (sustituir por los productos reales) ---------- */
  function seed() {
    return {
      version: 2,
      meta: { lastBackup: null },
      products: [
        { id: 1, code: '7501000623456', name: 'Galletas 25 GR CHOCOLATE', price: 18, stock: 48, unit: 'PZ', low: 8 },
        { id: 2, code: '7501055301234', name: 'Refresco 3L SABOR UVA',    price: 25, stock: 12, unit: 'PZ', low: 5 },
        { id: 3, code: '7501028904567', name: 'Huevo',                    price: 45, stock: 5,  unit: 'KG', low: 6 },
        { id: 4, code: '7501044556678', name: 'Azúcar 1 kg',              price: 22, stock: 0,  unit: 'PZ', low: 5 },
        { id: 5, code: '7501033344556', name: 'Arroz 1 kg',               price: 28, stock: 20, unit: 'PZ', low: 5 },
        { id: 6, code: '7501067788990', name: 'Papel higiénico',          price: 32, stock: 8,  unit: 'PZ', low: 4 }
      ],
      sales: [],      // ventas
      movements: [],  // movimientos de inventario (venta, entrada, merma, cancelación)
      sessions: [],   // aperturas y cierres de caja
      users: [
        { id: 1, name: 'Administrador', role: 'Administrador', pin: '1234', active: true },
        { id: 2, name: 'Cajero 1',      role: 'Cajero',        pin: '0000', active: true }
      ],
      counters: { sale: 1, move: 1, session: 1 }
    };
  }

  function ensureShape() {
    const base = seed();
    ['products', 'sales', 'movements', 'sessions', 'users'].forEach(k => { if (!Array.isArray(db[k])) db[k] = base[k]; });
    db.meta = db.meta || { lastBackup: null };
    db.counters = Object.assign({ sale: 1, move: 1, session: 1 }, db.counters || {});
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      db = raw ? JSON.parse(raw) : seed();
    } catch (e) {
      console.error('No se pudo leer el almacenamiento local', e);
      db = seed();
    }
    ensureShape();
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) {
      console.error('No se pudo guardar', e);
      if (api.onSaveError) api.onSaveError(e);
      return false;
    }
  }

  /* ---------- Respaldos ---------- */
  function exportJSON() { db.meta.lastBackup = h.nowISO(); persist(); return JSON.stringify(db, null, 2); }
  function importData(obj) {
    if (!obj || !Array.isArray(obj.products) || !Array.isArray(obj.sales) || !Array.isArray(obj.users) || !obj.users.length)
      throw new Error('El archivo no parece un respaldo válido de Abarrotes Gema.');
    db = obj; ensureShape(); persist();
  }
  function reset() { db = seed(); persist(); }

  /* ---------- Sincronización (se completa con Firebase en el Paso 2) ---------- */
  function pending() {
    return [db.sales, db.movements, db.sessions].reduce((n, arr) => n + arr.filter(x => x.synced === false).length, 0);
  }

  /* ---------- Registro de módulos ---------- */
  const ctx = { get db() { return db; }, persist, h };
  function register(name, factory) { api[name] = factory(ctx, api); }

  load();
  const api = {
    get db() { return db; },
    h, persist, register, onSaveError: null,
    exportJSON, importData, reset, pending
  };
  return api;
})();
