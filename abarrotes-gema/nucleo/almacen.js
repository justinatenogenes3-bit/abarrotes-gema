/* =====================================================================
   nucleo/almacen.js · Núcleo de datos
   ---------------------------------------------------------------------
   Aquí vive SOLO lo común: cargar/guardar, respaldo y datos de ejemplo.
   Las reglas de cada módulo están en su carpeta (modulos/xxx/xxx.datos.js)
   y se conectan con Almacen.registrar('nombre', ...).

   HOY: guarda en localStorage. PASO 2: aquí se conectará Firebase.
   Cada registro lleva "sincronizado:false" para saber qué falta subir a la nube.

   Forma de los datos (las colecciones serán las mismas en Firebase):
     productos   {id, codigo, nombre, precio, existencia, unidad, minimo}
     ventas      {folio, fecha, usuario, metodo, subtotal, descuento, total, recibido,
                  cambio, sesionId, estado, partidas[], sincronizado}
     movimientos {id, fecha, tipo, productoId, producto, cantidad, unidad, nota, usuario, sincronizado}
     sesiones    {id, abiertaEn, abiertaPor, fondoInicial, cerradaEn, cerradaPor, efectivoContado,
                  efectivoEsperado, diferencia, ventasEfectivo, ventasTarjeta, ventasTransferencia, notas, sincronizado}
     usuarios    {id, nombre, rol, pin, activo}
   ===================================================================== */
const Almacen = (function () {
  'use strict';

  const CLAVE = 'gemaPOS_v3';
  const bd = {};   // Siempre es el MISMO objeto: los módulos lo guardan y no se queda desactualizado.

  const util = {
    ahora: () => new Date().toISOString(),
    dinero: n => Math.round((Number(n) + Number.EPSILON) * 100) / 100,     // 2 decimales
    kilos: n => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000,    // 3 decimales
    siguienteId: lista => Math.max(0, ...lista.map(x => x.id)) + 1
  };

  /* ---------- Datos de ejemplo (sustituir por los productos reales) ---------- */
  function datosEjemplo() {
    return {
      version: 3,
      meta: { ultimoRespaldo: null },
      productos: [
        { id: 1, codigo: '7501000623456', nombre: 'Galletas 25 GR CHOCOLATE', precio: 18, existencia: 48, unidad: 'PZ', minimo: 8 },
        { id: 2, codigo: '7501055301234', nombre: 'Refresco 3L SABOR UVA',    precio: 25, existencia: 12, unidad: 'PZ', minimo: 5 },
        { id: 3, codigo: '7501028904567', nombre: 'Huevo',                    precio: 45, existencia: 5,  unidad: 'KG', minimo: 6 },
        { id: 4, codigo: '7501044556678', nombre: 'Azúcar 1 kg',              precio: 22, existencia: 0,  unidad: 'PZ', minimo: 5 },
        { id: 5, codigo: '7501033344556', nombre: 'Arroz 1 kg',               precio: 28, existencia: 20, unidad: 'PZ', minimo: 5 },
        { id: 6, codigo: '7501067788990', nombre: 'Papel higiénico',          precio: 32, existencia: 8,  unidad: 'PZ', minimo: 4 }
      ],
      ventas: [],
      movimientos: [],   // venta, entrada, merma, ajuste, cancelación
      sesiones: [],      // aperturas y cierres de caja
      usuarios: [
        { id: 1, nombre: 'Administrador', rol: 'Administrador', pin: '1234', activo: true },
        { id: 2, nombre: 'Cajero 1',      rol: 'Cajero',        pin: '0000', activo: true }
      ],
      contadores: { venta: 1, movimiento: 1, sesion: 1 }
    };
  }

  // Reemplaza el contenido de bd SIN cambiar el objeto
  function reemplazar(nuevo) {
    Object.keys(bd).forEach(k => delete bd[k]);
    Object.assign(bd, nuevo);
    asegurarEstructura();
  }

  function asegurarEstructura() {
    const base = datosEjemplo();
    ['productos', 'ventas', 'movimientos', 'sesiones', 'usuarios'].forEach(k => { if (!Array.isArray(bd[k])) bd[k] = base[k]; });
    bd.meta = bd.meta || { ultimoRespaldo: null };
    bd.contadores = Object.assign({ venta: 1, movimiento: 1, sesion: 1 }, bd.contadores || {});
  }

  function cargar() {
    let datos;
    try {
      const crudo = localStorage.getItem(CLAVE);
      datos = crudo ? JSON.parse(crudo) : datosEjemplo();
    } catch (e) {
      console.error('No se pudo leer el almacenamiento local', e);
      datos = datosEjemplo();
    }
    reemplazar(datos);
  }

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(bd)); return true; }
    catch (e) {
      console.error('No se pudo guardar', e);
      if (api.alErrorGuardar) api.alErrorGuardar(e);
      return false;
    }
  }

  /* ---------- Respaldos ---------- */
  function exportarJSON() { bd.meta.ultimoRespaldo = util.ahora(); guardar(); return JSON.stringify(bd, null, 2); }
  function importarDatos(obj) {
    if (!obj || !Array.isArray(obj.productos) || !Array.isArray(obj.ventas) || !Array.isArray(obj.usuarios) || !obj.usuarios.length)
      throw new Error('El archivo no parece un respaldo válido de Abarrotes Gema.');
    reemplazar(obj); guardar();
  }
  function restablecer() { reemplazar(datosEjemplo()); guardar(); }

  /* ---------- Sincronización (se completa con Firebase en el Paso 2) ---------- */
  function pendientes() {
    return [bd.ventas, bd.movimientos, bd.sesiones].reduce((n, lista) => n + lista.filter(x => x.sincronizado === false).length, 0);
  }

  /* ---------- Registro de módulos ---------- */
  const contexto = { bd, guardar, util };
  function registrar(nombre, fabrica) { api[nombre] = fabrica(contexto, api); }

  cargar();
  const api = { bd, util, guardar, registrar, alErrorGuardar: null, exportarJSON, importarDatos, restablecer, pendientes };
  return api;
})();
