/* modules/auth/auth.js · Acceso con PIN escrito con el teclado
   Flujo: elegir usuario (flechas) → escribir PIN de 4 números → entra solo (o Enter).
   Se recuerda el último usuario para ir directo al PIN.
   Nota: es una protección básica local; en el Paso 2 se reemplaza por Firebase Auth. */
(function () {
  'use strict';
  const { $, esc } = App;
  const MAX_FAILS = 5, LOCK_MS = 30000;
  let fails = 0, lockUntil = 0;

  function show() {
    const users = Store.users.active();
    const last = Number(localStorage.getItem('gemaLastUser'));
    const L = $('login');
    L.classList.remove('hidden');
    L.innerHTML = `<form class="login-card" id="loginForm" autocomplete="off">
      <div class="brand">🛒 Abarrotes <span>Gema</span></div>
      <p class="muted">Punto de venta</p>
      <label>Usuario
        <select id="loginUser">${users.map(u => `<option value="${u.id}" ${u.id === last ? 'selected' : ''}>${esc(u.name)} · ${u.role}</option>`).join('')}</select>
      </label>
      <label>PIN (4 números)
        <input id="loginPin" class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••">
      </label>
      <div class="loginmsg" id="loginMsg" role="alert"></div>
      <button class="primary xl" type="submit">Entrar</button>
      <div class="muted" style="text-align:center">Escribe tu PIN y se abrirá solo, o presiona Enter.</div>
    </form>`;

    const pin = $('loginPin'), msg = $('loginMsg');
    const remembered = users.some(u => u.id === last);
    (remembered ? pin : $('loginUser')).focus();

    pin.oninput = () => {
      pin.value = pin.value.replace(/\D/g, '').slice(0, 4);
      msg.textContent = '';
      if (pin.value.length === 4) submit();
    };
    $('loginForm').onsubmit = e => { e.preventDefault(); submit(); };
    // Después de elegir usuario con el teclado, pasar directo al PIN
    $('loginUser').onchange = () => pin.focus();

    function submit() {
      const wait = Math.ceil((lockUntil - Date.now()) / 1000);
      if (wait > 0) { msg.textContent = `Demasiados intentos. Espera ${wait} s.`; pin.value = ''; return; }
      if (pin.value.length < 4) { msg.textContent = 'El PIN tiene 4 números.'; pin.focus(); return; }
      const u = Store.users.authenticate(Number($('loginUser').value), pin.value);
      if (u) {
        fails = 0;
        localStorage.setItem('gemaLastUser', String(u.id));
        App.start(u);
      } else {
        fails++;
        pin.value = '';
        if (fails >= MAX_FAILS) { fails = 0; lockUntil = Date.now() + LOCK_MS; msg.textContent = 'Demasiados intentos. Espera 30 s.'; }
        else msg.textContent = 'PIN incorrecto.';
        const card = $('loginForm'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
        pin.focus();
      }
    }
  }

  App.registerAuth({ show });
})();
