/* =====================================================================
   core/app.js · Núcleo de la interfaz
   Utilidades compartidas, ventanas (modales), avisos, navegación y estado.
   Cada módulo se registra con App.register({...}) y NO toca a los demás:
   si uno falla al abrirse, solo se muestra el error en ese apartado.
   ===================================================================== */
const App = (function () {
  'use strict';

  /* ---------- Utilidades ---------- */
  const $ = id => document.getElementById(id);
  const money = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n) || 0);
  const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const qty = n => String(Math.round(Number(n) * 1000) / 1000);
  const fdate = iso => iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const isToday = iso => new Date(iso).toDateString() === new Date().toDateString();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isFractional = unit => unit !== 'PZ';
  const touchDevice = !window.matchMedia('(pointer:fine)').matches;

  function toast(msg, bad) {
    $('toastRoot').innerHTML = `<div class="toast ${bad ? 'bad' : ''}">${esc(msg)}</div>`;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $('toastRoot').innerHTML = '', bad ? 4200 : 2600);
  }
  Store.onSaveError = () => toast('No se pudo guardar en este equipo. Descarga un respaldo y libera espacio.', true);

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function downloadCSV(name, rows) {
    const body = rows.map(r => r.map(x => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    download(name, '\ufeff' + body, 'text/csv;charset=utf-8');
  }

  /* ---------- Ventanas (modales) ---------- */
  function closeModal() { $('modalRoot').innerHTML = ''; }
  function openModal(title, body, buttons, onDismiss) {
    const root = $('modalRoot');
    root.innerHTML = `<div class="overlay"><div class="modal" role="dialog" aria-modal="true">
      <div class="mhead"><h2>${esc(title)}</h2><button class="x" data-m="x" aria-label="Cerrar">✕</button></div>
      <div class="mbody">${body}</div>
      <div class="mfoot">${buttons.map((b, i) => `<button class="${b.cls || ''}" data-mb="${i}">${b.label}</button>`).join('')}</div>
    </div></div>`;
    root.onclick = e => {
      const t = e.target.closest('[data-m],[data-mb]');
      if (!t) return;
      if (t.dataset.m) { closeModal(); if (onDismiss) onDismiss(); return; }
      const b = buttons[+t.dataset.mb];
      if (b.onClick && b.onClick() === false) return;
      closeModal();
    };
    root.onkeydown = e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        const p = root.querySelector('[data-mb].primary');
        if (p) { e.preventDefault(); p.click(); }
      }
      if (e.key === 'Escape') { closeModal(); if (onDismiss) onDismiss(); }
    };
    const first = root.querySelector('input,select,textarea');
    if (first) setTimeout(() => { first.focus(); if (first.select) first.select(); }, 40);
  }

  function askNumber(title, label, opts = {}) {
    return new Promise(resolve => {
      const chips = (opts.chips || []).map(c => `<button type="button" data-chip="${c}">${c}</button>`).join('');
      openModal(title, `<label class="muted">${esc(label)}</label>
        <input id="numIn" type="number" inputmode="decimal" step="any" min="0" value="${opts.value ?? ''}" class="big" style="width:100%;margin-top:6px">
        ${chips ? `<div class="chips">${chips}</div>` : ''}`,
        [{ label: 'Cancelar', onClick: () => resolve(null) },
         { label: opts.okText || 'Aceptar', cls: 'primary', onClick: () => {
            const v = Number($('numIn').value);
            if (!Number.isFinite(v) || v <= 0) { toast('Escribe una cantidad válida.', true); return false; }
            resolve(v);
         } }],
        () => resolve(null));
      $('modalRoot').querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { $('numIn').value = b.dataset.chip; $('numIn').focus(); });
    });
  }

  function askConfirm(title, msg, okText, danger) {
    return new Promise(resolve => {
      openModal(title, `<p style="margin:0;line-height:1.5">${msg}</p>`,
        [{ label: 'Cancelar', onClick: () => resolve(false) },
         { label: okText || 'Aceptar', cls: danger ? 'primary danger' : 'primary', onClick: () => resolve(true) }],
        () => resolve(false));
    });
  }

  /* ---------- Módulos y navegación ---------- */
  const modules = [];
  const logoutChecks = [];
  let user = null, current = null, auth = null;

  const register = def => { modules.push(def); modules.sort((a, b) => (a.order || 99) - (b.order || 99)); };
  const registerAuth = a => { auth = a; };
  const onBeforeLogout = fn => logoutChecks.push(fn);
  const isAdmin = () => !!user && user.role === 'Administrador';

  function refreshStatus() {
    const on = navigator.onLine;
    $('connBadge').className = 'status ' + (on ? 'ok' : 'bad');
    $('connBadge').innerHTML = on ? '● En línea' : '● Sin conexión<br><span class="muted">Trabajando en modo local</span>';
    const n = Store.pending();
    $('pendingBadge').className = 'status ' + (n ? 'warn' : 'ok');
    $('pendingBadge').innerHTML = `⟳ Sin enviar a la nube: <b>${n}</b>`;
    const s = Store.cash.current();
    $('sideFoot').innerHTML = s ? `<b>● Caja abierta</b><br>Desde ${fdate(s.openedAt)}` : '<b>○ Caja cerrada</b><br>Abre la caja para vender.';
  }
  window.addEventListener('online', refreshStatus);
  window.addEventListener('offline', refreshStatus);

  function renderNav() {
    $('nav').innerHTML = modules.filter(m => m.roles.includes(user.role))
      .map(m => `<button class="nav" data-page="${m.id}">${m.icon} ${m.label}</button>`).join('');
  }

  function go(id) {
    const def = modules.find(m => m.id === id);
    if (!def || !user || !def.roles.includes(user.role)) { toast('Tu usuario no tiene permiso para esa sección.', true); return; }
    current = id;
    const view = $('view');
    view.onclick = view.oninput = view.onkeydown = view.onchange = null;   // cada módulo pone los suyos
    document.querySelectorAll('.nav').forEach(b => b.classList.toggle('active', b.dataset.page === id));
    try { def.render(view); }
    catch (err) {
      console.error('Error en el módulo ' + id, err);
      view.innerHTML = `<div class="note bad"><b>Hubo un error al abrir "${esc(def.label)}".</b> Los demás apartados siguen funcionando.<br><small>${esc(err.message)}</small></div>`;
    }
    refreshStatus();
    window.scrollTo(0, 0);
  }

  $('nav').addEventListener('click', e => { const b = e.target.closest('[data-page]'); if (b) go(b.dataset.page); });

  function start(u) {
    user = u;
    sessionStorage.setItem('gemaUser', String(u.id));
    $('login').classList.add('hidden'); $('login').innerHTML = '';
    $('app').classList.remove('hidden');
    $('whoName').textContent = u.name; $('whoRole').textContent = u.role;
    renderNav();
    go('sales');
  }

  function signOut() {
    sessionStorage.removeItem('gemaUser');
    user = null; current = null;
    closeModal();
    $('app').classList.add('hidden');
    if (auth) auth.show();
  }

  $('logoutBtn').onclick = async () => {
    for (const check of logoutChecks) {
      const msg = check();
      if (msg && !(await askConfirm('Salir', msg, 'Salir'))) return;
    }
    signOut();
  };

  return {
    $, money, r2, qty, fdate, isToday, esc, isFractional, touchDevice,
    toast, download, downloadCSV, openModal, closeModal, askNumber, askConfirm,
    register, registerAuth, onBeforeLogout, go, start, signOut, refreshStatus, isAdmin,
    get user() { return user; },
    setUser(u) { user = u; $('whoName').textContent = u.name; $('whoRole').textContent = u.role; },
    get current() { return current; }
  };
})();
