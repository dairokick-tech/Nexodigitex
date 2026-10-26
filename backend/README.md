# NOVA DIGITEX — backend multiempresa

API inicial para un POS multiempresa. Cada empresa recibe una base de datos PostgreSQL propia y un rol de conexión dedicado, con permisos limitados a esa base. El catálogo central solo conserva los metadatos mínimos de cada empresa y las credenciales de conexión cifradas con AES-256-GCM.

## Qué incluye

- Alta administrativa de empresas y aprovisionamiento de base de datos + rol PostgreSQL.
- Esquema separado por empresa para usuarios, productos, clientes, proveedores, caja, ventas, detalle de ventas y auditoría.
- Login con contraseña hash bcrypt y JWT con tenant ID.
- Endpoints iniciales de dashboard, productos, clientes, proveedores, apertura de caja y ventas.
- Idempotencia de ventas mediante `operationKey` UUID; la misma clave no registra una segunda venta.
- Transacción SQL para la venta y descuento de stock con bloqueo de filas.
- Contenedor Docker para PostgreSQL y API.

## Despliegue local

Requisitos: Docker y Docker Compose.

1. Copia `.env.example` como `.env` dentro de `backend/`.
2. Genera secretos fuertes; no reutilices los valores de ejemplo. Por ejemplo, genera 32 bytes hexadecimales para `CREDENTIAL_ENCRYPTION_KEY`.
3. Define `POSTGRES_PASSWORD` en el archivo `.env` (variable usada por Compose).
4. Define `CONTROL_DATABASE_URL`, `JWT_SECRET`, `SUPERADMIN_BOOTSTRAP_KEY`, `CREDENTIAL_ENCRYPTION_KEY` y `CORS_ORIGIN`.
5. Desde `backend/`, ejecuta `docker compose up --build -d`.
6. Comprueba `GET http://localhost:8080/api/health`.

Ejemplo para crear una empresa (mantén el secreto solo en un entorno administrativo seguro):

```bash
curl -X POST http://localhost:8080/api/provision/company \
  -H 'Content-Type: application/json' \
  -H 'X-Bootstrap-Key: TU_SECRETO_ADMINISTRATIVO' \
  -d '{
    "name":"Comercial Demo",
    "taxId":"20123456789",
    "businessType":"minimarket",
    "adminName":"Administrador",
    "adminEmail":"admin@demo.example",
    "adminPassword":"CAMBIA_ESTA_CLAVE_LARGA"
  }'
```

La respuesta devuelve el identificador y slug de empresa. El slug se usa en el login:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"companySlug":"SLUG_DEVUELTO","email":"admin@demo.example","password":"CAMBIA_ESTA_CLAVE_LARGA"}'
```

## Endpoints iniciales

- `GET /api/health`
- `POST /api/provision/company` — requiere cabecera `X-Bootstrap-Key`
- `POST /api/auth/login`
- `GET /api/company/me`
- `GET /api/dashboard`
- `GET|POST /api/products`
- `GET|POST /api/customers`
- `GET|POST /api/suppliers`
- `POST /api/cash/open`
- `POST /api/sales`
- `GET /api/audit` — administrador/gerente

Las rutas protegidas requieren `Authorization: Bearer <token>`. Para ventas, el cliente debe generar una clave UUID única `operationKey` y reutilizarla al reintentar la misma operación tras un corte de conexión.

## Antes de producción

Este backend es una base de implementación, no una certificación de producción. Antes de exponerlo a internet: coloca un proxy HTTPS, configura CORS con el dominio exacto, rota y almacena secretos en un gestor seguro, restringe red y permisos PostgreSQL, programa backups cifrados y prueba restauraciones, agrega recuperación de contraseña, gestión de usuarios/permisos granular, cierre de caja, anulaciones/devoluciones, reportes, monitoreo y pruebas automatizadas. No publiques el secreto de aprovisionamiento en el navegador. La integración SUNAT y la sincronización offline completa aún deben implementarse y validarse por separado.
