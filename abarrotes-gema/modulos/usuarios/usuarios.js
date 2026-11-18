/* modulos/usuarios/usuarios.js · Pantalla de usuarios (solo administrador)
   Reglas de negocio: modulos/usuarios/usuarios.datos.js */
(function () {
  'use strict';
  const { $, esc, aviso, abrirVentana } = App;

  App.registrar({ id: 'usuarios', orden: 5, icono: '🔐', etiqueta: 'Usuarios', roles: ['Administrador'], mostrar });

  function mostrar(vista) {
    vista.innerHTML = `
      <div class="heading"><div><h1>🔐 Usuarios y permisos</h1><div class="muted">El administrador gestiona productos, usuarios y reportes. El cajero opera ventas y caja.</div></div>
        <button class="primary" id="btnNuevoUsuario">+ Nuevo usuario</button></div>
      <div class="note warn">Los PIN son una protección básica para esta etapa. Los datos de ejemplo traen PIN 1234 (Administrador) y 0000 (Cajero 1): <b>cámbialos</b>. En el Paso 2 se reemplazan por Firebase Authentication.</div>
      <div class="card" style="margin-top:14px"><div class="tablewrap"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      ${Almacen.usuarios.todos().map(u => `<tr><td><b>${esc(u.nombre)}</b></td><td>${u.rol}</td><td><span class="pill ${u.activo ? '' : 'off'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td><button class="sm" data-accion="editar" data-id="${u.id}">Editar / PIN</button> ${u.id !== App.usuario.id ? `<button class="sm" data-accion="alternar" data-id="${u.id}">${u.activo ? 'Desactivar' : 'Activar'}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    vista.onclick = e => {
      if (e.target.closest('#btnNuevoUsuario')) return formulario();
      const b = e.target.closest('[data-accion]'); if (!b) return;
      const id = +b.dataset.id;
      if (b.dataset.accion === 'editar') formulario(id);
      else if (b.dataset.accion === 'alternar') {
        try { Almacen.usuarios.cambiarActivo(id, !Almacen.usuarios.porId(id).activo); mostrar(vista); } catch (err) { aviso(err.message, true); }
      }
    };
  }

  function formulario(id) {
    const u = id ? Almacen.usuarios.porId(id) : { nombre: '', rol: 'Cajero', pin: '' };
    abrirVentana(id ? 'Editar usuario' : 'Nuevo usuario', `<div class="formgrid">
      <label class="wide">Nombre<input id="uNombre" value="${esc(u.nombre)}"></label>
      <label>Rol<select id="uRol">${['Cajero', 'Administrador'].map(r => `<option ${u.rol === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <label>PIN (4 números)<input id="uPin" inputmode="numeric" maxlength="4" value="${esc(u.pin)}"></label></div>`,
      [{ texto: 'Cancelar' }, { texto: 'Guardar', clase: 'primary', alPulsar: () => {
        try {
          Almacen.usuarios.guardarUsuario({ nombre: $('uNombre').value, rol: $('uRol').value, pin: $('uPin').value }, id || undefined);
          if (id === App.usuario.id) App.fijarUsuario(Almacen.usuarios.porId(id));
          aviso('Usuario guardado.'); mostrar($('vista'));
        } catch (e) { aviso(e.message, true); return false; }
      } }]);
  }
})();
