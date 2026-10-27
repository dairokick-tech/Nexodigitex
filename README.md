# NOVA DIGITEX — POS y gestión empresarial multirrubro

Aplicación web adaptable a Windows y Android, con puntos de venta diferenciados por rubro, módulos generales, catálogo de empresas y sucursales, productos, inventario, clientes, proveedores, caja, cotizaciones, gastos, reportes y configuración de automatizaciones.

## Funciones incluidas en el repositorio

- 11 espacios POS de demostración diferenciados por rubro.
- Catálogo de 25 módulos generales y buscador de funciones.
- Creación de empresas en Supabase y asignación automática del creador como propietario.
- Membresías por empresa, roles y políticas de acceso RLS.
- Gestión de sucursales.
- Catálogo de productos por empresa con SKU, código de barras, costo, precio, stock inicial y mínimo.
- Inventario calculado desde el stock inicial y movimientos de kardex.
- Clientes y proveedores por empresa.
- Registro de gastos, cotizaciones y sesiones de caja.
- Reporte resumido de ventas, gastos, compras y productos.
- Preferencias de automatización por empresa.
- Cola de ventas locales con identificadores únicos y reintentos.
- RPC `register_sale` para registrar ventas de empresa en una transacción, validar stock y descontar existencias sin duplicar movimientos.
- PWA con archivos de aplicación cacheados para abrir la interfaz sin conexión.
- Exportación CSV del historial de ventas.

## Publicar la aplicación

La publicación se ejecuta mediante GitHub Actions en cada cambio a `main`. Revisa **Actions → Validate and deploy NOVA DIGITEX** para comprobar la validación y el despliegue. Si GitHub Pages no publica, entra a Settings → Pages y selecciona **GitHub Actions** como origen.

## Configurar Supabase

1. Abre el proyecto Supabase de NOVA DIGITEX.
2. Entra a **SQL Editor**.
3. Ejecuta el archivo completo `supabase/schema.sql` (esquema v3).
4. En la aplicación abre **Supabase y configuración**.
5. Introduce la URL del proyecto y la clave pública/publishable o anon pública.
6. Crea una cuenta e inicia sesión.
7. Abre **Empresas y sucursales**, crea una empresa y selecciónala.
8. Registra productos en **Productos reales** e inventario inicial; luego prueba ventas, clientes, proveedores, caja, gastos y cotizaciones.
9. Prueba con dos usuarios y dos dispositivos, incluida la pérdida de internet y la recuperación de la cola.

**Nunca pegues una clave `service_role` en la aplicación, en el navegador ni en GitHub.** La clave pública solo es segura junto con políticas RLS correctas.

## Aislamiento multiempresa

El esquema implementa una instancia PostgreSQL/Supabase con datos aislados por empresa mediante `company_id`, membresías y RLS. Crear una base de datos PostgreSQL física independiente para cada empresa requiere un backend privado de aprovisionamiento con credenciales de servidor; no se ejecuta desde la web estática y no se debe resolver exponiendo secretos.

## Limitaciones que aún requieren integración externa o pruebas

- La aplicación no debe usarse todavía como sistema fiscal/comercial de producción sin ejecutar y verificar el SQL en el proyecto real, probar permisos y validar recuperación de respaldos.
- La integración oficial de comprobantes SUNAT no está implementada ni homologada. Requiere proveedor/servicio backend, credenciales y certificados válidos, series, envío, consulta de CDR y pruebas.
- No se incluyen pagos reales ni conciliación bancaria automática con entidades financieras.
- Las reglas de automatización guardan preferencias; las tareas de fondo requieren un servicio programado en servidor.
- La PWA permite abrir la interfaz sin conexión, pero la sincronización con la nube ocurre al recuperar internet. Debe probarse con datos reales de ensayo antes de operación comercial.
- Los productos de demostración de los POS por rubro siguen siendo datos de muestra; para ventas con control de stock se debe registrar y seleccionar el catálogo real de la empresa.
- Este repositorio web no es un instalador nativo Windows ni un APK firmado. La PWA puede instalarse desde un navegador compatible; los instaladores nativos requieren empaquetado y pruebas adicionales.
