import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool, Client } = pg;
const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const CONTROL_DATABASE_URL = process.env.CONTROL_DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const BOOTSTRAP_KEY = process.env.SUPERADMIN_BOOTSTRAP_KEY;
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || '';
if (!CONTROL_DATABASE_URL || !JWT_SECRET || !BOOTSTRAP_KEY || !/^[a-fA-F0-9]{64}$/.test(ENCRYPTION_KEY)) {
  throw new Error('Set CONTROL_DATABASE_URL, JWT_SECRET, SUPERADMIN_BOOTSTRAP_KEY and a 64-hex CREDENTIAL_ENCRYPTION_KEY.');
}
const control = new Pool({ connectionString: CONTROL_DATABASE_URL, max: 10, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined });
const tenantPools = new Map();
const key = Buffer.from(ENCRYPTION_KEY, 'hex');

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
app.use((req, res, next) => {
  const allowed = (process.env.CORS_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && (allowed.includes(origin) || allowed.includes('*'))) {
    res.setHeader('Access-Control-Allow-Origin', allowed.includes('*') ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Bootstrap-Key, Idempotency-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const ident = value => '"' + String(value).replaceAll('"', '""') + '"';
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const slugify = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}
function decrypt(value) {
  const [iv, tag, data] = value.split('.').map(s => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
async function initControl() {
  await control.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      tax_id TEXT,
      business_type TEXT NOT NULL DEFAULT 'general',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
      database_name TEXT NOT NULL UNIQUE,
      database_user TEXT NOT NULL UNIQUE,
      encrypted_database_password TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS tenant_admins (
      id BIGSERIAL PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, email)
    );
    CREATE TABLE IF NOT EXISTS provision_events (
      id BIGSERIAL PRIMARY KEY,
      tenant_id UUID REFERENCES tenants(id),
      action TEXT NOT NULL,
      success BOOLEAN NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
async function poolForTenant(tenant) {
  if (tenantPools.has(tenant.id)) return tenantPools.get(tenant.id);
  const password = decrypt(tenant.encrypted_database_password);
  const pool = new Pool({
    host: new URL(CONTROL_DATABASE_URL).hostname,
    port: Number(new URL(CONTROL_DATABASE_URL).port || 5432),
    database: tenant.database_name,
    user: tenant.database_user,
    password,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined
  });
  pool.on('error', err => console.error('Tenant pool error:', err.message));
  tenantPools.set(tenant.id, pool);
  return pool;
}
async function getTenant(id) {
  const { rows } = await control.query("SELECT * FROM tenants WHERE id = $1 AND status = 'active'", [id]);
  return rows[0] || null;
}
async function audit(pool, userId, action, entityType, entityId = null, metadata = {}) {
  await pool.query('INSERT INTO audit_log(user_id, action, entity_type, entity_id, metadata) VALUES($1,$2,$3,$4,$5)', [userId, action, entityType, entityId == null ? null : String(entityId), metadata]);
}
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Se requiere iniciar sesión.' });
  try { req.identity = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Sesión inválida o vencida.' }); }
}
function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.identity?.role) ? next() : res.status(403).json({ error: 'No tienes permiso para esta operación.' });
}
async function tenantContext(req, res, next) {
  try {
    const tenant = await getTenant(req.identity.tenantId);
    if (!tenant) return res.status(403).json({ error: 'Empresa inactiva o inexistente.' });
    req.tenant = tenant;
    req.db = await poolForTenant(tenant);
    next();
  } catch (e) { next(e); }
}
function issueToken(tenant, user) {
  return jwt.sign({ sub: String(user.id), tenantId: tenant.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h', issuer: 'nova-digitex' });
}

app.get('/api/health', async (_req, res) => {
  try { await control.query('SELECT 1'); res.json({ status: 'ok', service: 'NOVA DIGITEX API', database: 'connected' }); }
  catch { res.status(503).json({ status: 'error' }); }
});

// Company creation is restricted by a secret held by the operator, never exposed in frontend code.
app.post('/api/provision/company', async (req, res, next) => {
  if (!safeEqual(req.headers['x-bootstrap-key'], BOOTSTRAP_KEY)) return res.status(403).json({ error: 'Operación administrativa no autorizada.' });
  const { name, taxId = '', businessType = 'general', adminName, adminEmail, adminPassword } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 140 ||
      typeof adminName !== 'string' || adminName.trim().length < 2 ||
      typeof adminEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) ||
      typeof adminPassword !== 'string' || adminPassword.length < 12 || adminPassword.length > 200) {
    return res.status(400).json({ error: 'Indica nombre de empresa, administrador, correo válido y contraseña de al menos 12 caracteres.' });
  }
  const id = crypto.randomUUID();
  const slug = slugify(name) + '-' + id.slice(0, 6);
  const dbName = 'nova_' + id.replaceAll('-', '').slice(0, 24);
  const dbUser = 'tenant_' + id.replaceAll('-', '').slice(0, 20);
  const dbPassword = crypto.randomBytes(32).toString('base64url');
  const admin = new Client({ connectionString: CONTROL_DATABASE_URL, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined });
  let roleCreated = false;
  let databaseCreated = false;
  try {
    await admin.connect();
    await admin.query('BEGIN');
    await admin.query('INSERT INTO tenants(id,name,slug,tax_id,business_type,status,database_name,database_user,encrypted_database_password) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, name.trim(), slug, String(taxId).slice(0, 32), String(businessType).slice(0, 80), 'active', dbName, dbUser, encrypt(dbPassword)]);
    await admin.query('INSERT INTO tenant_admins(tenant_id,email) VALUES($1,$2)', [id, adminEmail.trim().toLowerCase()]);
    await admin.query('COMMIT');
    await admin.query(`CREATE ROLE ${ident(dbUser)} LOGIN PASSWORD ${literal(dbPassword)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
    roleCreated = true;
    await admin.query(`CREATE DATABASE ${ident(dbName)} OWNER ${ident(dbUser)}`);
    databaseCreated = true;
    const tenantClient = new Client({
      host: new URL(CONTROL_DATABASE_URL).hostname,
      port: Number(new URL(CONTROL_DATABASE_URL).port || 5432),
      database: dbName, user: dbUser, password: dbPassword,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined
    });
    await tenantClient.connect();
    try {
      await tenantClient.query(await fs.readFile(path.join(here, 'tenant-schema.sql'), 'utf8'));
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await tenantClient.query('INSERT INTO app_users(email,password_hash,full_name,role) VALUES($1,$2,$3,$4)', [adminEmail.trim().toLowerCase(), passwordHash, adminName.trim(), 'admin']);
    } finally { await tenantClient.end(); }
    await control.query('INSERT INTO provision_events(tenant_id,action,success,details) VALUES($1,$2,true,$3)', [id, 'company_created', { slug, database: dbName }]);
    res.status(201).json({ message: 'Empresa creada y base de datos independiente inicializada.', company: { id, name: name.trim(), slug, businessType, status: 'active' }, database: { isolated: true, created: true }, adminLogin: { companySlug: slug, email: adminEmail.trim().toLowerCase() } });
  } catch (e) {
    try { await admin.query('ROLLBACK'); } catch {}
    try { await control.query('INSERT INTO provision_events(tenant_id,action,success,details) VALUES($1,$2,false,$3)', [id, 'company_creation_failed', { error: String(e.message).slice(0, 300) }]); } catch {}
    if (databaseCreated) try { await admin.query(`DROP DATABASE IF EXISTS ${ident(dbName)}`); } catch {}
    if (roleCreated) try { await admin.query(`DROP ROLE IF EXISTS ${ident(dbUser)}`); } catch {}
    try { await control.query('DELETE FROM tenants WHERE id=$1', [id]); } catch {}
    next(e);
  } finally { await admin.end().catch(() => {}); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { companySlug, email, password } = req.body || {};
    if (![companySlug, email, password].every(v => typeof v === 'string' && v.length <= 300)) return res.status(400).json({ error: 'Completa empresa, correo y contraseña.' });
    const result = await control.query("SELECT * FROM tenants WHERE slug=$1 AND status='active'", [companySlug]);
    const tenant = result.rows[0];
    if (!tenant) return res.status(401).json({ error: 'Credenciales incorrectas.' });
    const db = await poolForTenant(tenant);
    const users = await db.query('SELECT id,email,password_hash,full_name,role,active FROM app_users WHERE email=$1', [email.trim().toLowerCase()]);
    const user = users.rows[0];
    if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Credenciales incorrectas.' });
    await audit(db, user.id, 'login', 'user', user.id);
    res.json({ token: issueToken(tenant, user), user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role }, company: { id: tenant.id, name: tenant.name, slug: tenant.slug, businessType: tenant.business_type } });
  } catch (e) { next(e); }
});

app.get('/api/company/me', auth, tenantContext, (req, res) => res.json({ id: req.tenant.id, name: req.tenant.name, slug: req.tenant.slug, taxId: req.tenant.tax_id, businessType: req.tenant.business_type }));
app.get('/api/dashboard', auth, tenantContext, async (req, res, next) => {
  try {
    const [products, customers, sales, lowStock] = await Promise.all([
      req.db.query('SELECT count(*)::int AS count FROM products WHERE active=true'),
      req.db.query('SELECT count(*)::int AS count FROM customers'),
      req.db.query("SELECT count(*)::int AS count, COALESCE(sum(total),0)::numeric(14,2) AS total FROM sales WHERE status='completed' AND created_at >= date_trunc('day',now())"),
      req.db.query('SELECT count(*)::int AS count FROM products WHERE active=true AND stock <= min_stock')
    ]);
    res.json({ products: products.rows[0].count, customers: customers.rows[0].count, todaySales: sales.rows[0].count, todayTotal: sales.rows[0].total, lowStock: lowStock.rows[0].count });
  } catch (e) { next(e); }
});

const resourceConfig = {
  products: { table: 'products', fields: ['sku','barcode','name','category','unit','cost','price','stock','min_stock'], required: ['name'], searchable: ['name','sku','barcode'], role: ['admin','manager','warehouse','seller','cashier'] },
  customers: { table: 'customers', fields: ['document_number','name','phone','email','address'], required: ['name'], searchable: ['name','document_number','phone'], role: ['admin','manager','cashier','seller'] },
  suppliers: { table: 'suppliers', fields: ['document_number','name','phone','email','address'], required: ['name'], searchable: ['name','document_number','phone'], role: ['admin','manager','warehouse'] }
};
for (const [resource, cfg] of Object.entries(resourceConfig)) {
  app.get('/api/' + resource, auth, tenantContext, requireRole(...cfg.role), async (req, res, next) => {
    try {
      const q = String(req.query.q || '').slice(0, 100);
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const where = q ? 'WHERE ' + cfg.searchable.map(f => `COALESCE(${ident(f)}::text,'') ILIKE $1`).join(' OR ') : '';
      const params = q ? ['%' + q + '%', limit, offset] : [limit, offset];
      const sql = `SELECT * FROM ${ident(cfg.table)} ${where} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
      const { rows } = await req.db.query(sql, params);
      res.json({ data: rows, limit, offset });
    } catch (e) { next(e); }
  });
  app.post('/api/' + resource, auth, tenantContext, requireRole('admin','manager', ...(resource === 'products' ? ['warehouse'] : resource === 'suppliers' ? ['warehouse'] : [])), async (req, res, next) => {
    try {
      const body = req.body || {};
      for (const f of cfg.required) if (typeof body[f] !== 'string' || !body[f].trim()) return res.status(400).json({ error: `El campo ${f} es obligatorio.` });
      const fields = cfg.fields.filter(f => body[f] !== undefined);
      if (!fields.length) return res.status(400).json({ error: 'No hay campos para guardar.' });
      for (const f of ['cost','price','stock','min_stock']) if (body[f] !== undefined && (!Number.isFinite(Number(body[f])) || Number(body[f]) < 0)) return res.status(400).json({ error: `Valor inválido para ${f}.` });
      const values = fields.map(f => typeof body[f] === 'string' ? body[f].trim() : body[f]);
      const placeholders = fields.map((_, i) => '$' + (i + 1));
      const { rows } = await req.db.query(`INSERT INTO ${ident(cfg.table)}(${fields.map(ident).join(',')}) VALUES(${placeholders.join(',')}) RETURNING *`, values);
      await audit(req.db, req.identity.sub, 'create', resource, rows[0].id, {});
      res.status(201).json({ data: rows[0] });
    } catch (e) { next(e); }
  });
}

app.post('/api/cash/open', auth, tenantContext, requireRole('admin','manager','cashier'), async (req, res, next) => {
  try {
    const amount = Number(req.body?.openingAmount || 0);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'Monto inicial inválido.' });
    const existing = await req.db.query("SELECT id FROM cash_sessions WHERE opened_by=$1 AND status='open' LIMIT 1", [req.identity.sub]);
    if (existing.rowCount) return res.status(409).json({ error: 'Ya tienes una caja abierta.', sessionId: existing.rows[0].id });
    const { rows } = await req.db.query('INSERT INTO cash_sessions(opened_by,opening_amount) VALUES($1,$2) RETURNING *', [req.identity.sub, amount]);
    await audit(req.db, req.identity.sub, 'open', 'cash_session', rows[0].id);
    res.status(201).json({ data: rows[0] });
  } catch (e) { next(e); }
});
app.post('/api/sales', auth, tenantContext, requireRole('admin','manager','cashier','seller'), async (req, res, next) => {
  const client = await req.db.connect().catch(next);
  if (!client) return;
  try {
    const { operationKey, customerId = null, items, paymentMethod = 'cash', discount = 0 } = req.body || {};
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(operationKey || ''))) return res.status(400).json({ error: 'operationKey UUID es obligatorio para evitar ventas duplicadas.' });
    if (!Array.isArray(items) || items.length < 1 || items.length > 200) return res.status(400).json({ error: 'La venta debe incluir entre 1 y 200 productos.' });
    if (!['cash','card','transfer','wallet','credit'].includes(paymentMethod)) return res.status(400).json({ error: 'Medio de pago inválido.' });
    const disc = Number(discount);
    if (!Number.isFinite(disc) || disc < 0) return res.status(400).json({ error: 'Descuento inválido.' });
    await client.query('BEGIN');
    const prior = await client.query('SELECT * FROM sales WHERE operation_key=$1', [operationKey]);
    if (prior.rowCount) { await client.query('COMMIT'); return res.json({ data: prior.rows[0], duplicate: true }); }
    let subtotal = 0;
    const normalized = [];
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) throw Object.assign(new Error('Cantidad inválida.'), { status: 400 });
      const { rows } = await client.query('SELECT id,name,price,stock FROM products WHERE id=$1 AND active=true FOR UPDATE', [item.productId]);
      if (!rows[0]) throw Object.assign(new Error('Producto no encontrado o inactivo.'), { status: 400 });
      if (rows[0].stock < qty) throw Object.assign(new Error('Stock insuficiente para ' + rows[0].name), { status: 409 });
      const unitPrice = item.unitPrice === undefined ? Number(rows[0].price) : Number(item.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw Object.assign(new Error('Precio inválido.'), { status: 400 });
      const line = Math.round(qty * unitPrice * 100) / 100;
      subtotal += line;
      normalized.push({ id: rows[0].id, quantity: qty, unitPrice, line });
    }
    subtotal = Math.round(subtotal * 100) / 100;
    if (disc > subtotal) throw Object.assign(new Error('El descuento no puede superar el subtotal.'), { status: 400 });
    const total = Math.round((subtotal - disc) * 100) / 100;
    const cash = await client.query("SELECT id FROM cash_sessions WHERE opened_by=$1 AND status='open' ORDER BY id DESC LIMIT 1", [req.identity.sub]);
    const sale = await client.query('INSERT INTO sales(operation_key,customer_id,user_id,cash_session_id,subtotal,discount,total,payment_method) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [operationKey, customerId, req.identity.sub, cash.rows[0]?.id || null, subtotal, disc, total, paymentMethod]);
    for (const item of normalized) {
      await client.query('INSERT INTO sale_items(sale_id,product_id,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,$5)', [sale.rows[0].id, item.id, item.quantity, item.unitPrice, item.line]);
      await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2', [item.quantity, item.id]);
    }
    await client.query('INSERT INTO audit_log(user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)', [req.identity.sub, 'create', 'sale', sale.rows[0].id, { operationKey, total }]);
    await client.query('COMMIT');
    res.status(201).json({ data: sale.rows[0], items: normalized });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
});
app.get('/api/audit', auth, tenantContext, requireRole('admin','manager'), async (req, res, next) => {
  try {
    const { rows } = await req.db.query('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200');
    res.json({ data: rows });
  } catch (e) { next(e); }
});

app.use((err, req, res, _next) => {
  console.error('API error:', err.message);
  if (res.headersSent) return;
  const status = err.status || (err.code === '23505' ? 409 : 500);
  res.status(status).json({ error: status === 500 ? 'Error interno del servidor.' : err.message });
});

initControl().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`NOVA DIGITEX API listening on ${PORT}`));
}).catch(err => {
  console.error('Cannot initialize control database:', err.message);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await Promise.all([...tenantPools.values()].map(p => p.end().catch(() => {})));
  await control.end().catch(() => {});
  process.exit(0);
});
