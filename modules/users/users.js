/* modules/users/users.js · Pantalla de usuarios (solo administrador)
   Reglas de negocio: modules/users/users.data.js */
(function () {
  'use strict';
  const { $, esc, toast, openModal } = App;

  App.register({ id: 'users', order: 5, icon: '🔐', label: 'Usuarios', roles: ['Administrador'], render });

  function render(view) {
    view.innerHTML = `
      <div class="heading"><div><h1>🔐 Usuarios y permisos</h1><div class="muted">El administrador gestiona productos, usuarios y reportes. El cajero opera ventas y caja.</div></div>
        <button class="primary" id="newUserBtn">+ Nuevo usuario</button></div>
      <div class="note warn">Los PIN son una protección básica para esta etapa. Los datos de ejemplo traen PIN 1234 (Administrador) y 0000 (Cajero 1): <b>cámbialos</b>. En el Paso 2 se reemplazan por Firebase Authentication.</div>
      <div class="card" style="margin-top:14px"><div class="tablewrap"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      ${Store.users.all().map(u => `<tr><td><b>${esc(u.name)}</b></td><td>${u.role}</td><td><span class="pill ${u.active ? '' : 'off'}">${u.active ? 'Activo' : 'Inactivo'}</span></td>
        <td><button class="sm" data-act="edit" data-id="${u.id}">Editar / PIN</button> ${u.id !== App.user.id ? `<button class="sm" data-act="toggle" data-id="${u.id}">${u.active ? 'Desactivar' : 'Activar'}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    view.onclick = e => {
      if (e.target.closest('#newUserBtn')) return form();
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = +b.dataset.id;
      if (b.dataset.act === 'edit') form(id);
      else if (b.dataset.act === 'toggle') {
        try { Store.users.setActive(id, !Store.users.byId(id).active); render(view); } catch (err) { toast(err.message, true); }
      }
    };
  }

  function form(id) {
    const u = id ? Store.users.byId(id) : { name: '', role: 'Cajero', pin: '' };
    openModal(id ? 'Editar usuario' : 'Nuevo usuario', `<div class="formgrid">
      <label class="wide">Nombre<input id="uName" value="${esc(u.name)}"></label>
      <label>Rol<select id="uRole">${['Cajero', 'Administrador'].map(r => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <label>PIN (4 números)<input id="uPin" inputmode="numeric" maxlength="4" value="${esc(u.pin)}"></label></div>`,
      [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: () => {
        try {
          Store.users.save({ name: $('uName').value, role: $('uRole').value, pin: $('uPin').value }, id || undefined);
          if (id === App.user.id) App.setUser(Store.users.byId(id));
          toast('Usuario guardado.'); render($('view'));
        } catch (e) { toast(e.message, true); return false; }
      } }]);
  }
})();
