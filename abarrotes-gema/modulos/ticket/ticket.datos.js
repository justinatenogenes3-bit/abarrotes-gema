/* modulos/ticket/ticket.datos.js · Datos y reglas del ticket (uno por tienda)
   Los datos del ticket se guardan dentro de la información de cada tienda (Almacen.bd.meta.ticket),
   así que cada tienda tiene el suyo y entra en sus respaldos. */
const Ticket = (function () {
  'use strict';

  const PREDETERMINADO = () => ({
    nombre: (typeof Tiendas !== 'undefined' && Tiendas.activa()) ? Tiendas.activa().nombre : 'Abarrotes Gema',
    direccion: '', colonia: '', telefono: '',
    aviso: 'ESTE TICKET NO ES UN COMPROBANTE FISCAL',
    despedida: '***** GRACIAS POR SU COMPRA *****',
    pie1: 'REVISAR SU MERCANCIA Y CAMBIO',
    pie2: 'NO SE ACEPTAN DEVOLUCIONES',
    ancho: 80,            // milímetros: 58 u 80
    imprimirAuto: false   // imprimir solo al cobrar
  });

  const config = () => Object.assign(PREDETERMINADO(), Almacen.bd.meta.ticket || {});
  function guardarConfig(c) {
    c.ancho = Number(c.ancho) === 58 ? 58 : 80;
    Almacen.bd.meta.ticket = c; Almacen.guardar();
  }

  /* ---------- Importe con letra (MXN) ---------- */
  const UN = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUN', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const DE = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const CE = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  function menorMil(n) {
    if (n === 100) return 'CIEN';
    const c = CE[Math.floor(n / 100)], r = n % 100, partes = [c];
    if (r < 30) partes.push(UN[r]);
    else partes.push(DE[Math.floor(r / 10)] + (r % 10 ? ' Y ' + UN[r % 10] : ''));
    return partes.filter(Boolean).join(' ');
  }
  function entero(n) {
    if (n === 0) return 'CERO';
    const mill = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), resto = n % 1000, s = [];
    if (mill) s.push(mill === 1 ? 'UN MILLON' : menorMil(mill) + ' MILLONES');
    if (mil) s.push(mil === 1 ? 'MIL' : menorMil(mil) + ' MIL');
    if (resto) s.push(menorMil(resto));
    return s.join(' ');
  }
  function importeConLetra(total) {
    const t = Math.round(Number(total) * 100), pesos = Math.floor(t / 100), cent = t % 100;
    return `${entero(pesos)} ${pesos === 1 ? 'PESO' : 'PESOS'} ${String(cent).padStart(2, '0')}/100 MONEDA NACIONAL`;
  }

  return { config, guardarConfig, importeConLetra, PREDETERMINADO };
})();
