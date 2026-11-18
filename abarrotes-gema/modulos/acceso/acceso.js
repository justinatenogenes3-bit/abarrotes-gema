/* modulos/acceso/acceso.js · Acceso con PIN escrito con el teclado
   Flujo: elegir usuario (flechas) → escribir PIN de 4 números → entra solo (o Enter).
   Se recuerda el último usuario para ir directo al PIN.
   Nota: es una protección básica local; en el Paso 2 se reemplaza por Firebase Auth. */
(function () {
  'use strict';
  const { $, esc } = App;
  const MAX_FALLOS = 5, BLOQUEO_MS = 30000;
  let fallos = 0, bloqueadoHasta = 0;

  function mostrar() {
    const usuarios = Almacen.usuarios.activos();
    const ultimo = Number(localStorage.getItem('gemaUltimoUsuario'));
    const pantalla = $('pantallaAcceso');
    pantalla.classList.remove('oculto');
    pantalla.innerHTML = `<form class="acceso-tarjeta" id="formAcceso" autocomplete="off">
      <div class="brand">🛒 Abarrotes <span>Gema</span></div>
      <p class="muted">Punto de venta</p>
      <label>Usuario
        <select id="selUsuario">${usuarios.map(u => `<option value="${u.id}" ${u.id === ultimo ? 'selected' : ''}>${esc(u.nombre)} · ${u.rol}</option>`).join('')}</select>
      </label>
      <label>PIN (4 números)
        <input id="campoPin" class="campo-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••">
      </label>
      <div class="mensaje-acceso" id="mensajeAcceso" role="alert"></div>
      <button class="primary xl" type="submit">Entrar</button>
      <div class="muted" style="text-align:center">Escribe tu PIN y se abrirá solo, o presiona Enter.</div>
    </form>`;

    const pin = $('campoPin'), mensaje = $('mensajeAcceso');
    const recordado = usuarios.some(u => u.id === ultimo);
    (recordado ? pin : $('selUsuario')).focus();

    pin.oninput = () => {
      pin.value = pin.value.replace(/\D/g, '').slice(0, 4);
      mensaje.textContent = '';
      if (pin.value.length === 4) entrar();
    };
    $('formAcceso').onsubmit = e => { e.preventDefault(); entrar(); };
    $('selUsuario').onchange = () => pin.focus();   // tras elegir usuario con el teclado, pasa al PIN

    function entrar() {
      const espera = Math.ceil((bloqueadoHasta - Date.now()) / 1000);
      if (espera > 0) { mensaje.textContent = `Demasiados intentos. Espera ${espera} s.`; pin.value = ''; return; }
      if (pin.value.length < 4) { mensaje.textContent = 'El PIN tiene 4 números.'; pin.focus(); return; }
      const u = Almacen.usuarios.autenticar(Number($('selUsuario').value), pin.value);
      if (u) {
        fallos = 0;
        localStorage.setItem('gemaUltimoUsuario', String(u.id));
        App.iniciar(u);
      } else {
        fallos++;
        pin.value = '';
        if (fallos >= MAX_FALLOS) { fallos = 0; bloqueadoHasta = Date.now() + BLOQUEO_MS; mensaje.textContent = 'Demasiados intentos. Espera 30 s.'; }
        else mensaje.textContent = 'PIN incorrecto.';
        const tarjeta = $('formAcceso'); tarjeta.classList.remove('sacudir'); void tarjeta.offsetWidth; tarjeta.classList.add('sacudir');
        pin.focus();
      }
    }
  }

  App.registrarAcceso({ mostrar });
})();
