-- Run only in a newly provisioned company database.
CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','manager','cashier','seller','warehouse')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT UNIQUE,
  barcode TEXT,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'UND',
  cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  min_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  document_number TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  document_number TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cash_sessions (
  id BIGSERIAL PRIMARY KEY,
  opened_by BIGINT REFERENCES app_users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opening_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  closed_by BIGINT REFERENCES app_users(id),
  closed_at TIMESTAMPTZ,
  closing_amount NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);
CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  operation_key UUID NOT NULL UNIQUE,
  receipt_number BIGSERIAL,
  customer_id BIGINT REFERENCES customers(id),
  user_id BIGINT REFERENCES app_users(id),
  cash_session_id BIGINT REFERENCES cash_sessions(id),
  subtotal NUMERIC(14,2) NOT NULL,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','card','transfer','wallet','credit')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','cancelled','returned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL REFERENCES sales(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
