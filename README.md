# NOVA DIGITEX — 11 rubros y POS especializados

Aplicación web adaptable a Windows y Android, con colores independientes por rubro.

## Rubros
1. Farmacias y boticas — azul
2. Restaurantes y cafeterías — naranja
3. Bodegas y minimarkets — verde
4. Tiendas y comercios — morado
5. Tiendas de ropa y calzado — fucsia
6. Ferreterías — turquesa
7. Mayoristas y distribuidores — azul oscuro
8. Hoteles y hospedajes — dorado
9. Servicios y oficinas — aqua
10. Almacenes y logística — azul
11. Librerías y útiles — violeta

## Activar Supabase
1. Crea un proyecto en Supabase.
2. Abre SQL Editor y ejecuta `supabase/schema.sql`.
3. En la app, abre **Supabase y configuración** e introduce Project URL y la clave pública (publishable/anon).
4. Crea una cuenta con email y contraseña e inicia sesión.
5. Las ventas guardadas mientras estabas offline se mantienen en una cola local y se intentan sincronizar al iniciar sesión/volver a estar en línea.

## Seguridad
- No usar service_role en el frontend.
- El esquema aplica RLS y limita cada usuario a sus propias ventas y clientes.
- La URL y clave pública se guardan en localStorage del navegador.
- No guardar información real sensible en la versión prototipo.

## Estado y límites
El POS incluye carrito, cantidades, medios de pago, historial local y exportación CSV. Los catálogos, precios y stock son de ejemplo. La sincronización actual está implementada para ventas y clientes; debe validarse con dos o más dispositivos antes de operar en producción. No incluye todavía SUNAT, comprobantes electrónicos, impresoras, inventario transaccional completo, caja con arqueo, gestión multiempresa/roles ni auditoría integral.
