# NOVA DIGITEX — reconstrucción desde cero

La reconstrucción se está desarrollando en la rama nova-digitex-desde-cero para validarla antes de sustituir la rama principal. El código anterior queda conservado en la rama backup-anterior-2026-10-26.

## Funciones de esta base inicial
- Interfaz adaptable a computadora y móvil.
- Resumen, punto de venta, productos e inventario, clientes, proveedores, caja, compras, reportes y configuración.
- Registro local de empresas y rubros.
- Catálogo de productos, precios y existencias.
- POS con carrito, control de stock, métodos de pago y registro local de ventas.
- Apertura y movimientos básicos de caja.
- Exportación CSV de ventas y respaldo/restauración JSON.
- Aplicación web progresiva con caché para abrir la interfaz sin conexión después de la primera visita.

## Limitaciones que no deben confundirse con funciones terminadas
Los datos se guardan en el navegador mediante almacenamiento local; no se sincronizan entre dispositivos. La separación de empresas de esta versión es lógica y local, no aislamiento de seguridad en servidor. Todavía no hay autenticación real, permisos en backend, base PostgreSQL aplicada, sincronización offline idempotente, integración oficial SUNAT ni instaladores nativos de Windows o Android. Esta versión inicial no debe considerarse lista para producción.

## Siguientes etapas
1. Backend API y PostgreSQL con aislamiento por empresa, autenticación y permisos del lado del servidor.
2. Cola offline con identificadores idempotentes y sincronización sin duplicados.
3. Inventario transaccional, compras, devoluciones, caja por usuario y auditoría.
4. Integración oficial de comprobantes electrónicos SUNAT en ambiente de pruebas.
5. Pruebas automatizadas, respaldo, monitoreo y empaquetado Windows/Android.

La rama main no se modifica con esta etapa. La integración se realizará después de validar la nueva base.
