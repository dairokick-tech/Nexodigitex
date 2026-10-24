# NOVA DIGITEX — ERP + POS multirrubro

Aplicación web adaptable a escritorio Windows y móviles Android, con un punto de venta independiente por rubro y colores diferenciados.

## 11 rubros y operaciones especializadas

| Rubro | Color | Herramientas específicas |
|---|---|---|
| Farmacias y boticas | Azul | Lotes, vencimientos, receta/control especial y compras a laboratorio |
| Restaurantes y cafeterías | Naranja | Mesas, comandas, reservas y delivery |
| Bodegas y minimarkets | Verde | Código de barras, ventas por peso/unidad y fiado/cobranza |
| Tiendas y comercios | Morado | Cotizaciones, pedidos, apartados, garantías y descuentos |
| Tiendas de ropa y calzado | Fucsia | Tallas, colores, variantes, cambios y promociones |
| Ferreterías | Turquesa | Conversión de unidades, cotizaciones de obra y compras |
| Mayoristas y distribuidores | Azul oscuro | Precios por volumen, crédito, despacho y rutas |
| Hoteles y hospedajes | Dorado | Reservas, check-in/check-out y cargos de huésped |
| Servicios y oficinas | Aqua | Órdenes de servicio, contratos y cobros recurrentes |
| Almacenes y logística | Azul | Recepción/despacho, picking/packing y transferencias |
| Librerías y útiles | Violeta | ISBN, kits escolares y cotizaciones para colegios |

## Funciones comunes del POS

- Catálogo demostrativo, carrito, cantidades y medios de pago.
- Guardado de ventas en el dispositivo, historial y exportación CSV.
- Apertura/cierre de caja demostrativos.
- Formularios operativos específicos por rubro.
- Registros adicionales guardados localmente con cola para sincronización.
- PWA básica para instalar en navegador compatible y caché de archivos principales.

## Activar Supabase

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor** y ejecuta el archivo `supabase/schema.sql`.
3. En la aplicación entra a **Supabase y configuración**.
4. Ingresa Project URL y clave pública/publishable (o anon public key).
5. Crea una cuenta e inicia sesión.
6. Verifica que la cola de ventas y operaciones se sincronice; prueba con dos dispositivos antes de usar datos reales.

El esquema contiene tablas `sales`, `customers` y `business_records` con RLS que restringe registros al usuario autenticado.

## GitHub Pages

La publicación automática está definida en `.github/workflows/deploy.yml`. Si el workflow falla en **Setup Pages**, abre Settings → Pages del repositorio y selecciona **GitHub Actions** como Build and deployment source. Después vuelve a ejecutar el workflow desde Actions.

## Seguridad y estado real

- Nunca insertar la clave `service_role` en el frontend ni en archivos de GitHub.
- El esquema usa RLS, pero cada empresa/tenant, sucursal y rol todavía requiere modelado antes de operación multiempresa.
- No introducir datos reales sensibles en esta versión prototipo.
- Los productos, precios y stocks que aparecen en pantalla son demostrativos.
- Las operaciones especiales se guardan en el navegador y se envían a `business_records` cuando hay sesión y conexión; debe validarse la sincronización multi-dispositivo y la recuperación de fallos.
- No está listo para facturación electrónica SUNAT. Faltan integración homologada, certificados, series, envío/consulta de comprobantes y pruebas.
- También faltan inventario transaccional con kardex, permisos por rol, auditoría completa, impresoras, compras completas, cuentas por cobrar/pagar y pruebas de seguridad.

**No usar todavía como sistema contable/fiscal o caja comercial de producción.**
