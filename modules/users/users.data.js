/* modules/users/users.data.js · Reglas de usuarios y acceso por PIN */
Store.register('users', ({ db, persist, h }) => {
  const byId = id => db.users.find(u => u.id === id);
  const active = () => db.users.filter(u => u.active);
  const adminsActive = () => db.users.filter(u => u.role === 'Administrador' && u.active);

  function authenticate(id, pin) {
    const u = byId(id);
    return u && u.active && String(pin) === u.pin ? u : null;
  }

  function save(data, id) {
    const name = String(data.name || '').trim();
    if (!name) throw new Error('Escribe el nombre.');
    if (!/^\d{4}$/.test(String(data.pin || ''))) throw new Error('El PIN debe tener 4 números.');
    if (db.users.some(u => u.name.toLowerCase() === name.toLowerCase() && u.id !== id)) throw new Error('Ya existe un usuario con ese nombre.');
    if (id) {
      const u = byId(id);
      if (u.role === 'Administrador' && data.role !== 'Administrador' && adminsActive().length <= 1)
        throw new Error('Debe quedar al menos un administrador activo.');
      Object.assign(u, { name, role: data.role, pin: String(data.pin) });
    } else {
      db.users.push({ id: h.nextId(db.users), name, role: data.role, pin: String(data.pin), active: true });
    }
    persist();
  }

  function setActive(id, on) {
    const u = byId(id);
    if (!on && u.role === 'Administrador' && adminsActive().length <= 1) throw new Error('Debe quedar al menos un administrador activo.');
    u.active = on;
    persist();
  }

  return { byId, active, authenticate, save, setActive, all: () => db.users };
});
