# Abarrotes Gema · Punto de Venta

## Abrirlo en Visual Studio Code
1. Abre la carpeta `abarrotes-gema` en VS Code.
2. Instala la extensión **Live Server** → clic derecho en `index.html` → *Open with Live Server*.
   (El modo sin internet / instalable en tablet necesita http://localhost o https.)

## Acceso (cámbialos en Usuarios)
Elige usuario con las flechas, escribe el PIN con el teclado (4 números) y entra solo.
- Administrador: 1234 · Cajero 1: 0000

## Pagos con tarjeta y transferencia (rastreo)
Antes de cobrar, el cajero debe capturar la referencia:
- **Tarjeta:** el número de «Operación #» del ticket de la terminal (solo números, 6 a 20 dígitos).
- **Transferencia:** el folio / clave de rastreo del comprobante (letras y números, 4 a 40).
La referencia queda guardada en la venta, no se puede repetir en otra venta vigente
y se puede buscar en Reportes → Ventas.

## Estructura: una carpeta por apartado
```
index.html
nucleo/
  almacen.js      Guardado, respaldo y registro de módulos (aquí entrará Firebase)
  app.js          Utilidades, ventanas, avisos y navegación
  arranque.js     Arranque
estilos/base.css  Estilos compartidos
modulos/
  acceso/         Acceso con PIN            (acceso.js, acceso.css)
  ventas/         Inicio / Ventas           (ventas.js, ventas.css, ventas.datos.js)
  inventario/     Inventario                (inventario.js, inventario.datos.js)
  caja/           Corte de caja             (caja.js, caja.css, caja.datos.js)
  reportes/       Reportes                  (reportes.js)
  usuarios/       Usuarios                  (usuarios.js, usuarios.datos.js)
  configuracion/  Configuración y respaldos (configuracion.js)
```
- `xxx.js` = pantalla · `xxx.datos.js` = reglas de negocio · `xxx.css` = estilos solo de ese módulo.
- Un módulo no modifica la pantalla de otro. Si uno falla al abrirse, solo muestra su error y los demás siguen.
- Dependencias entre datos (declaradas): ventas usa inventario y caja; caja y reportes leen ventas.

## Nombres en español
Carpetas, archivos, funciones, variables, elementos de pantalla y campos de datos están en español
(sin acentos ni ñ en los nombres de archivos y de código, para evitar problemas en servidores y Firebase;
los textos que ve el usuario sí llevan acentos). Las clases CSS compartidas (`card`, `row`, `pill`…) siguen en inglés.
Colecciones de datos: productos, ventas, movimientos, sesiones, usuarios.

## Agregar un módulo nuevo (ej. proveedores)
1. Crear `modulos/proveedores/` con `proveedores.js` (y `proveedores.datos.js` / `.css` si hace falta).
2. En el `.js`: `App.registrar({ id:'proveedores', orden:7, icono:'🚚', etiqueta:'Proveedores', roles:['Administrador'], mostrar(vista){...} })`
3. Agregar sus `<script>`/`<link>` en `index.html` y los archivos en la lista de `sw.js`.

## Estado
Hecho y probado: ventas (pieza y peso; efectivo, transferencia y tarjeta con referencia; descuento), inventario,
caja, reportes, usuarios con PIN, respaldo JSON, modo sin conexión.
Pendiente: Firebase (Paso 2), proveedores, pruebas reales en la tienda.

## Varias tiendas (agregado)
Al abrir el sistema primero se elige la tienda y después el usuario y el PIN. Cada tienda guarda su propia
información (productos, ventas, caja y usuarios) y no se mezcla con la de otra. Abarrotes Gema conserva los
datos que ya tenía. El nombre de la tienda en la que se entró aparece en la barra lateral izquierda y, al elegir usuario, en la pantalla de acceso
(«Entrarás a: …» y el botón «Entrar a …»). El administrador ve el inventario de todas las tiendas en la opción
**🏬 Todas las tiendas** del menú lateral (resumen por tienda + lista de productos con filtro por tienda) y puede agregar tiendas nuevas desde ahí. Archivos nuevos: `modulos/tiendas/` (tiendas.datos.js, tiendas.js, tiendas.css).
Una tienda nueva empieza vacía, con los usuarios de ejemplo: Administrador 1234 y Cajero 1 0000.

## Ticket por tienda (agregado)
Cada tienda tiene su propio ticket (nombre, dirección, teléfono, avisos y ancho de papel 58/80 mm) en el menú **🧾 Ticket**
(solo administrador). Al cobrar aparece «🖨️ Imprimir ticket» y en Reportes → detalle de venta, «Reimprimir ticket».
Se puede activar la impresión automática al cobrar. Archivos: `modulos/ticket/` (ticket.js, ticket.datos.js).
