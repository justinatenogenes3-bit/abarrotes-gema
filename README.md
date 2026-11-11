# Abarrotes Gema · Punto de Venta

## Abrirlo en Visual Studio Code
1. Abre la carpeta `abarrotes-gema` en VS Code.
2. Instala la extensión **Live Server** → clic derecho en `index.html` → *Open with Live Server*.
   (El modo sin internet / instalable en tablet necesita http://localhost o https; con doble clic también abre, pero sin esa parte.)

## Acceso (cámbialos en Usuarios)
Elige usuario con las flechas, escribe el PIN con el teclado (4 números) y entra solo.
- Administrador: 1234 · Cajero 1: 0000

## Estructura: una carpeta por apartado
```
index.html
core/
  store.js        Guardado, respaldo y registro de módulos (aquí entrará Firebase)
  app.js          Utilidades, ventanas, avisos y navegación
  boot.js         Arranque
css/base.css      Estilos compartidos
modules/
  auth/           Acceso con PIN          (auth.js, auth.css)
  sales/          Inicio / Ventas         (sales.js, sales.css, sales.data.js)
  inventory/      Inventario              (inventory.js, inventory.data.js)
  cash/           Corte de caja           (cash.js, cash.css, cash.data.js)
  reports/        Reportes                (reports.js)
  users/          Usuarios                (users.js, users.data.js)
  settings/       Configuración/respaldos (settings.js)
```
- `xxx.js` = pantalla · `xxx.data.js` = reglas de negocio · `xxx.css` = estilos solo de ese módulo.
- Un módulo no modifica la pantalla de otro. Si uno falla al abrirse, solo muestra su error y los demás siguen.
- Dependencias entre datos (declaradas): ventas usa inventario y caja; caja y reportes leen ventas.

## Agregar un módulo nuevo (ej. proveedores)
1. Crear `modules/providers/` con `providers.js` (y `providers.data.js` / `.css` si hace falta).
2. En el `.js`: `App.register({ id:'providers', order:7, icon:'🚚', label:'Proveedores', roles:['Administrador'], render(view){...} })`
3. Agregar sus `<script>`/`<link>` en `index.html` y los archivos en la lista de `sw.js`.

## Estado
Hecho y probado: ventas (pieza y peso; efectivo, transferencia y tarjeta; descuento), inventario, caja, reportes,
usuarios con PIN, respaldo JSON, modo sin conexión.
Pendiente: Firebase (Paso 2), proveedores, pruebas reales en la tienda.
