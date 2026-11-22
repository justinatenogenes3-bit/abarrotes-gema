/* modulos/tiendas/tiendas.datos.js · Tiendas: lista, datos separados por tienda y resumen global
   IMPORTANTE: este archivo se carga ANTES de nucleo/almacen.js.
   Cómo funciona: cada tienda guarda sus datos en su propia llave de localStorage.
   La tienda 1 (Abarrotes Gema) usa la llave original 'gemaPOS_v3', así que la información
   que ya existe se conserva tal cual. Las demás usan 'gemaPOS_v3__<id>'.
   El resto del sistema no cambia: sigue leyendo y guardando como siempre. */
const Tiendas = (function () {
  'use strict';
  const CLAVE_BASE = 'gemaPOS_v3', CLAVE_LISTA = 'gemaTiendas', CLAVE_SESION = 'gemaTienda';
  const real = { get: Storage.prototype.getItem, set: Storage.prototype.setItem };
  const leer = k => real.get.call(localStorage, k);

  const ESTANDAR = [
    { id: 't1', nombre: 'Abarrotes Gema', icono: '🛒' },
    { id: 't2', nombre: 'Cremería El Llanito', icono: '🧀' },
    { id: 't3', nombre: 'El Tío Sam', icono: '🏪' }
  ];
  let lista = null;
  try { lista = JSON.parse(leer(CLAVE_LISTA)); } catch (e) { lista = null; }
  if (!Array.isArray(lista) || !lista.length) lista = ESTANDAR.map(t => ({ ...t }));

  const claveDe = id => id === 't1' ? CLAVE_BASE : CLAVE_BASE + '__' + id;
  let activaId = sessionStorage.getItem(CLAVE_SESION);
  if (!lista.some(t => t.id === activaId)) activaId = 't1';

  // Redirige la llave de datos a la tienda activa (los demás módulos no se enteran)
  Storage.prototype.getItem = function (k) { return real.get.call(this, k === CLAVE_BASE ? claveDe(activaId) : k); };
  Storage.prototype.setItem = function (k, v) { return real.set.call(this, k === CLAVE_BASE ? claveDe(activaId) : k, v); };

  const todas = () => lista.slice();
  const activa = () => lista.find(t => t.id === activaId);

  // Cambia de tienda: guarda la actual y carga la elegida (si es nueva, empieza vacía)
  function seleccionar(id) {
    if (!lista.some(t => t.id === id)) return false;
    if (id !== activaId) {
      const anterior = activaId;
      Almacen.guardar();
      try {
        activaId = id;
        const crudo = leer(claveDe(id));
        if (crudo) Almacen.importarDatos(JSON.parse(crudo));
        else { Almacen.restablecer(); Almacen.bd.productos.length = 0; Almacen.guardar(); }
      } catch (e) {
        console.error('No se pudo abrir la tienda', e);
        activaId = anterior;
        return false;
      }
    }
    sessionStorage.setItem(CLAVE_SESION, id);
    return true;
  }

  function agregar(nombre) {
    nombre = String(nombre || '').trim();
    if (!nombre) throw new Error('Escribe el nombre de la tienda.');
    if (lista.some(t => t.nombre.toLowerCase() === nombre.toLowerCase())) throw new Error('Ya existe una tienda con ese nombre.');
    const id = 't' + (Math.max(0, ...lista.map(t => Number(t.id.slice(1)) || 0)) + 1);
    lista.push({ id, nombre, icono: '🏪' });
    real.set.call(localStorage, CLAVE_LISTA, JSON.stringify(lista));
    return id;
  }

  // Productos de una tienda (la activa se lee de memoria; las demás, de su llave guardada)
  function productosDe(t) {
    let datos = null;
    if (t.id === activaId) datos = Almacen.bd;
    else { try { datos = JSON.parse(leer(claveDe(t.id))); } catch (e) { datos = null; } }
    return (datos && Array.isArray(datos.productos)) ? datos.productos : [];
  }

  // Resumen de inventario de TODAS las tiendas (solo lo usa el administrador, en «Todas las tiendas»)
  function resumen() {
    return lista.map(t => {
      const p = productosDe(t);
      return {
        tienda: t, activa: t.id === activaId, productos: p.length,
        bajos: p.filter(x => x.existencia > 0 && x.existencia <= x.minimo).length,
        agotados: p.filter(x => x.existencia <= 0).length,
        valor: p.reduce((s, x) => s + (Number(x.existencia) || 0) * (Number(x.precio) || 0), 0)
      };
    });
  }

  // Todos los productos de todas las tiendas, uno por fila: { tienda, producto }
  function inventarioTodas() {
    return lista.flatMap(t => productosDe(t).map(producto => ({ tienda: t, producto })));
  }

  return { todas, activa, seleccionar, agregar, resumen, inventarioTodas };
})();
