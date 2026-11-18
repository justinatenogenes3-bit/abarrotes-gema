/* modulos/usuarios/usuarios.datos.js · Reglas de usuarios y acceso por PIN */
Almacen.registrar('usuarios', ({ bd, guardar, util }) => {
  const porId = id => bd.usuarios.find(u => u.id === id);
  const activos = () => bd.usuarios.filter(u => u.activo);
  const adminsActivos = () => bd.usuarios.filter(u => u.rol === 'Administrador' && u.activo);

  function autenticar(id, pin) {
    const u = porId(id);
    return u && u.activo && String(pin) === u.pin ? u : null;
  }

  function guardarUsuario(datos, id) {
    const nombre = String(datos.nombre || '').trim();
    if (!nombre) throw new Error('Escribe el nombre.');
    if (!/^\d{4}$/.test(String(datos.pin || ''))) throw new Error('El PIN debe tener 4 números.');
    if (bd.usuarios.some(u => u.nombre.toLowerCase() === nombre.toLowerCase() && u.id !== id)) throw new Error('Ya existe un usuario con ese nombre.');
    if (id) {
      const u = porId(id);
      if (u.rol === 'Administrador' && u.activo && datos.rol !== 'Administrador' && adminsActivos().length <= 1)
        throw new Error('Debe quedar al menos un administrador activo.');
      Object.assign(u, { nombre, rol: datos.rol, pin: String(datos.pin) });
    } else {
      bd.usuarios.push({ id: util.siguienteId(bd.usuarios), nombre, rol: datos.rol, pin: String(datos.pin), activo: true });
    }
    guardar();
  }

  function cambiarActivo(id, activo) {
    const u = porId(id);
    if (!activo && u.rol === 'Administrador' && adminsActivos().length <= 1) throw new Error('Debe quedar al menos un administrador activo.');
    u.activo = activo;
    guardar();
  }

  return { porId, activos, autenticar, guardarUsuario, cambiarActivo, todos: () => bd.usuarios };
});
