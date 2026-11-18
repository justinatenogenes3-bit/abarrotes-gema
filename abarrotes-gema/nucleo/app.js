/* =====================================================================
   nucleo/app.js · Núcleo de la interfaz
   Utilidades compartidas, ventanas, avisos, navegación y estado.
   Cada módulo se registra con App.registrar({...}) y NO toca a los demás:
   si uno falla al abrirse, solo se muestra el error en ese apartado.
   ===================================================================== */
const App = (function () {
  'use strict';

  /* ---------- Utilidades ---------- */
  const $ = id => document.getElementById(id);
  const moneda = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n) || 0);
  const redondear = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const formatoCant = n => String(Math.round(Number(n) * 1000) / 1000);
  const fechaHora = iso => iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const esHoy = iso => new Date(iso).toDateString() === new Date().toDateString();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const esFraccionable = unidad => unidad !== 'PZ';
  const esTactil = !window.matchMedia('(pointer:fine)').matches;

  function aviso(mensaje, error) {
    $('raizAviso').innerHTML = `<div class="toast ${error ? 'bad' : ''}">${esc(mensaje)}</div>`;
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => $('raizAviso').innerHTML = '', error ? 4200 : 2600);
  }
  Almacen.alErrorGuardar = () => aviso('No se pudo guardar en este equipo. Descarga un respaldo y libera espacio.', true);

  function descargar(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function descargarCSV(nombre, filas) {
    const cuerpo = filas.map(f => f.map(x => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    descargar(nombre, '\ufeff' + cuerpo, 'text/csv;charset=utf-8');
  }

  /* ---------- Ventanas (modales) ---------- */
  function cerrarVentana() { $('raizVentana').innerHTML = ''; }
  function abrirVentana(titulo, cuerpo, botones, alDescartar) {
    const raiz = $('raizVentana');
    raiz.innerHTML = `<div class="overlay"><div class="modal" role="dialog" aria-modal="true">
      <div class="mhead"><h2>${esc(titulo)}</h2><button class="x" data-cerrar="1" aria-label="Cerrar">✕</button></div>
      <div class="mbody">${cuerpo}</div>
      <div class="mfoot">${botones.map((b, i) => `<button class="${b.clase || ''}" data-boton="${i}">${b.texto}</button>`).join('')}</div>
    </div></div>`;
    raiz.onclick = e => {
      const t = e.target.closest('[data-cerrar],[data-boton]');
      if (!t) return;
      if (t.dataset.cerrar) { cerrarVentana(); if (alDescartar) alDescartar(); return; }
      const b = botones[+t.dataset.boton];
      if (b.alPulsar && b.alPulsar() === false) return;
      cerrarVentana();
    };
    raiz.onkeydown = e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        const p = raiz.querySelector('[data-boton].primary');
        if (p) { e.preventDefault(); p.click(); }
      }
      if (e.key === 'Escape') { cerrarVentana(); if (alDescartar) alDescartar(); }
    };
    const primero = raiz.querySelector('input,select,textarea');
    if (primero) setTimeout(() => { primero.focus(); if (primero.select) primero.select(); }, 40);
  }

  function pedirNumero(titulo, etiqueta, opciones = {}) {
    return new Promise(resolver => {
      const atajos = (opciones.atajos || []).map(c => `<button type="button" data-atajo="${c}">${c}</button>`).join('');
      abrirVentana(titulo, `<label class="muted">${esc(etiqueta)}</label>
        <input id="campoNumero" type="number" inputmode="decimal" step="any" min="0" value="${opciones.valor ?? ''}" class="big" style="width:100%;margin-top:6px">
        ${atajos ? `<div class="chips">${atajos}</div>` : ''}`,
        [{ texto: 'Cancelar', alPulsar: () => resolver(null) },
         { texto: opciones.textoOk || 'Aceptar', clase: 'primary', alPulsar: () => {
            const v = Number($('campoNumero').value);
            if (!Number.isFinite(v) || v <= 0) { aviso('Escribe una cantidad válida.', true); return false; }
            resolver(v);
         } }],
        () => resolver(null));
      $('raizVentana').querySelectorAll('[data-atajo]').forEach(b => b.onclick = () => { $('campoNumero').value = b.dataset.atajo; $('campoNumero').focus(); });
    });
  }

  function pedirConfirmacion(titulo, mensaje, textoOk, peligro) {
    return new Promise(resolver => {
      abrirVentana(titulo, `<p style="margin:0;line-height:1.5">${mensaje}</p>`,
        [{ texto: 'Cancelar', alPulsar: () => resolver(false) },
         { texto: textoOk || 'Aceptar', clase: peligro ? 'primary danger' : 'primary', alPulsar: () => resolver(true) }],
        () => resolver(false));
    });
  }

  /* ---------- Módulos y navegación ---------- */
  const modulos = [];
  const revisionesSalida = [];
  let usuario = null, actual = null, acceso = null;

  const registrar = def => { modulos.push(def); modulos.sort((a, b) => (a.orden || 99) - (b.orden || 99)); };
  const registrarAcceso = a => { acceso = a; };
  const alSalir = fn => revisionesSalida.push(fn);
  const esAdmin = () => !!usuario && usuario.rol === 'Administrador';

  function actualizarEstado() {
    const enLinea = navigator.onLine;
    $('estadoConexion').className = 'status ' + (enLinea ? 'ok' : 'bad');
    $('estadoConexion').innerHTML = enLinea ? '● En línea' : '● Sin conexión<br><span class="muted">Trabajando en modo local</span>';
    const n = Almacen.pendientes();
    $('estadoPendientes').className = 'status ' + (n ? 'warn' : 'ok');
    $('estadoPendientes').innerHTML = `⟳ Sin enviar a la nube: <b>${n}</b>`;
    const s = Almacen.caja.actual();
    $('pieMenu').innerHTML = s ? `<b>● Caja abierta</b><br>Desde ${fechaHora(s.abiertaEn)}` : '<b>○ Caja cerrada</b><br>Abre la caja para vender.';
    actualizarInsignias();
  }
  window.addEventListener('online', actualizarEstado);
  window.addEventListener('offline', actualizarEstado);

  function pintarMenu() {
    $('menu').innerHTML = modulos.filter(m => m.roles.includes(usuario.rol))
      .map(m => `<button class="nav" data-pagina="${m.id}">${m.icono} ${m.etiqueta}<span class="insignia oculto" data-insignia="${m.id}"></span></button>`).join('');
  }

  // Un módulo puede definir insignia() para mostrar un número rojo junto a su nombre en el menú
  function actualizarInsignias() {
    if (!usuario) return;
    modulos.forEach(m => {
      const el = document.querySelector(`[data-insignia="${m.id}"]`); if (!el) return;
      const n = m.insignia ? Number(m.insignia()) || 0 : 0;
      el.textContent = n; el.classList.toggle('oculto', n === 0);
    });
  }

  function ir(id) {
    const def = modulos.find(m => m.id === id);
    if (!def || !usuario || !def.roles.includes(usuario.rol)) { aviso('Tu usuario no tiene permiso para esa sección.', true); return; }
    actual = id;
    const vista = $('vista');
    vista.onclick = vista.oninput = vista.onkeydown = vista.onchange = null;   // cada módulo pone los suyos
    document.querySelectorAll('.nav').forEach(b => b.classList.toggle('active', b.dataset.pagina === id));
    try { def.mostrar(vista); }
    catch (err) {
      console.error('Error en el módulo ' + id, err);
      vista.innerHTML = `<div class="note bad"><b>Hubo un error al abrir "${esc(def.etiqueta)}".</b> Los demás apartados siguen funcionando.<br><small>${esc(err.message)}</small></div>`;
    }
    actualizarEstado();
    window.scrollTo(0, 0);
  }

  $('menu').addEventListener('click', e => { const b = e.target.closest('[data-pagina]'); if (b) ir(b.dataset.pagina); });

  function iniciar(u) {
    usuario = u;
    sessionStorage.setItem('gemaUsuario', String(u.id));
    $('pantallaAcceso').classList.add('oculto'); $('pantallaAcceso').innerHTML = '';
    $('aplicacion').classList.remove('oculto');
    $('nombreUsuario').textContent = u.nombre; $('rolUsuario').textContent = u.rol;
    pintarMenu();
    ir('ventas');
    // Avisos al entrar (ej. alertas pendientes para el administrador)
    const avisos = modulos.filter(m => m.roles.includes(u.rol) && m.avisoInicio).map(m => m.avisoInicio()).filter(Boolean);
    if (avisos.length) aviso(avisos[0], true);
  }

  function cerrarSesion() {
    sessionStorage.removeItem('gemaUsuario');
    usuario = null; actual = null;
    cerrarVentana();
    $('aplicacion').classList.add('oculto');
    if (acceso) acceso.mostrar();
  }

  $('btnSalir').onclick = async () => {
    for (const revisar of revisionesSalida) {
      const mensaje = revisar();
      if (mensaje && !(await pedirConfirmacion('Salir', mensaje, 'Salir'))) return;
    }
    cerrarSesion();
  };

  return {
    $, moneda, redondear, formatoCant, fechaHora, esHoy, esc, esFraccionable, esTactil,
    aviso, descargar, descargarCSV, abrirVentana, cerrarVentana, pedirNumero, pedirConfirmacion,
    registrar, registrarAcceso, alSalir, ir, iniciar, cerrarSesion, actualizarEstado, esAdmin,
    get usuario() { return usuario; },
    fijarUsuario(u) { usuario = u; $('nombreUsuario').textContent = u.nombre; $('rolUsuario').textContent = u.rol; },
    get actual() { return actual; }
  };
})();
