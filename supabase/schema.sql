-- NOVA DIGITEX — esquema multiempresa v3
-- Ejecutar COMPLETO en Supabase > SQL Editor con el propietario del proyecto.
-- Usa una sola instancia PostgreSQL con aislamiento por empresa (tenant_id/RLS).
-- Crear una base PostgreSQL física por empresa requiere un backend administrativo privado,
-- nunca una clave service_role dentro del navegador.

create extension if not exists pgcrypto;

-- Tablas base compatibles con la versión anterior
create table if not exists public.sales(
 id text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 rubric_id text not null,
 rubric_name text not null,
 customer_name text not null default 'Público general',
 payment_method text not null,
 items jsonb not null default '[]'::jsonb,
 total numeric(12,2) not null check(total>=0),
 created_at timestamptz not null default now()
);
create table if not exists public.customers(
 id text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null,
 document_number text,
 phone text,
 created_at timestamptz not null default now()
);
create table if not exists public.business_records(
 id text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 rubric_id text not null,
 record_type text not null,
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

-- Empresas, membresías y sucursales
create table if not exists public.companies(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 160),
 tax_id text,
 industry text not null default 'Comercio general',
 currency text not null default 'PEN',
 created_by uuid not null references auth.users(id),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.company_memberships(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'owner' check(role in ('owner','admin','manager','cashier','sales','viewer')),
 status text not null default 'active' check(status in ('active','invited','suspended')),
 created_at timestamptz not null default now(),
 unique(company_id,user_id)
);
create table if not exists public.branches(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 code text not null,
 name text not null,
 address text,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(company_id,code)
);

-- Añadir empresa a los datos heredados sin romper instalaciones existentes
alter table public.sales add column if not exists company_id uuid references public.companies(id) on delete restrict;
alter table public.customers add column if not exists company_id uuid references public.companies(id) on delete restrict;
alter table public.business_records add column if not exists company_id uuid references public.companies(id) on delete restrict;
create index if not exists sales_company_date_idx on public.sales(company_id,created_at desc);
create index if not exists customers_company_name_idx on public.customers(company_id,name);
create index if not exists business_records_company_idx on public.business_records(company_id,created_at desc);

-- Catálogo real e inventario con movimientos trazables
create table if not exists public.products(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 sku text,
 barcode text,
 name text not null,
 category text not null default 'General',
 unit text not null default 'unidad',
 cost numeric(14,4) not null default 0 check(cost>=0),
 price numeric(14,4) not null default 0 check(price>=0),
 min_stock numeric(14,3) not null default 0 check(min_stock>=0),
 active boolean not null default true,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(company_id,sku)
);
create unique index if not exists products_company_barcode_uidx on public.products(company_id,barcode) where barcode is not null and barcode<>'';
create table if not exists public.inventory_movements(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 movement_type text not null check(movement_type in ('opening','purchase','sale','return_in','return_out','transfer_in','transfer_out','adjustment','damage')),
 quantity numeric(14,3) not null check(quantity<>0),
 unit_cost numeric(14,4) not null default 0 check(unit_cost>=0),
 reference_type text,
 reference_id text,
 idempotency_key text,
 notes text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(company_id,idempotency_key)
);
create index if not exists inventory_movements_product_date_idx on public.inventory_movements(company_id,product_id,created_at desc);

-- Compras y proveedores
create table if not exists public.suppliers(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 name text not null,
 tax_id text,
 phone text,
 email text,
 address text,
 notes text,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.purchases(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 supplier_id uuid references public.suppliers(id) on delete restrict,
 document_number text,
 status text not null default 'draft' check(status in ('draft','ordered','received','cancelled')),
 subtotal numeric(14,2) not null default 0 check(subtotal>=0),
 tax numeric(14,2) not null default 0 check(tax>=0),
 total numeric(14,2) not null default 0 check(total>=0),
 notes text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.purchase_items(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 purchase_id uuid not null references public.purchases(id) on delete cascade,
 product_id uuid references public.products(id) on delete restrict,
 description text not null,
 quantity numeric(14,3) not null check(quantity>0),
 unit_cost numeric(14,4) not null check(unit_cost>=0),
 total numeric(14,2) not null check(total>=0)
);

-- Caja, movimientos de dinero, gastos, cotizaciones y cuentas por cobrar
create table if not exists public.cash_sessions(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete restrict,
 user_id uuid not null references auth.users(id),
 opening_amount numeric(14,2) not null default 0 check(opening_amount>=0),
 expected_amount numeric(14,2),
 counted_amount numeric(14,2),
 difference numeric(14,2),
 status text not null default 'open' check(status in ('open','closed')),
 opened_at timestamptz not null default now(),
 closed_at timestamptz
);
create unique index if not exists cash_one_open_session_user_idx on public.cash_sessions(company_id,user_id) where status='open';
create table if not exists public.cash_movements(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 cash_session_id uuid references public.cash_sessions(id) on delete restrict,
 movement_type text not null check(movement_type in ('sale','income','expense','withdrawal','deposit','refund','opening','closing')),
 amount numeric(14,2) not null check(amount>=0),
 payment_method text,
 reference_id text,
 description text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.expenses(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 category text not null,
 description text not null,
 amount numeric(14,2) not null check(amount>=0),
 document_number text,
 expense_date date not null default current_date,
 status text not null default 'recorded' check(status in ('pending','recorded','void')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.quotes(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 customer_id uuid references public.customers(id) on delete set null,
 customer_name text not null,
 items jsonb not null default '[]'::jsonb,
 total numeric(14,2) not null default 0 check(total>=0),
 status text not null default 'draft' check(status in ('draft','sent','accepted','rejected','expired','converted')),
 valid_until date,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.receivables(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 customer_id uuid references public.customers(id) on delete set null,
 sale_id text references public.sales(id) on delete set null,
 description text not null,
 amount numeric(14,2) not null check(amount>=0),
 paid_amount numeric(14,2) not null default 0 check(paid_amount>=0 and paid_amount<=amount),
 due_date date,
 status text not null default 'pending' check(status in ('pending','partial','paid','void')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);

-- Auditoría, ajustes por empresa y reglas de automatización
create table if not exists public.audit_logs(
 id bigint generated always as identity primary key,
 company_id uuid references public.companies(id) on delete cascade,
 actor_id uuid references auth.users(id),
 action text not null,
 table_name text not null,
 record_id text,
 old_data jsonb,
 new_data jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.company_module_settings(
 company_id uuid not null references public.companies(id) on delete cascade,
 module_key text not null,
 enabled boolean not null default true,
 settings jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 primary key(company_id,module_key)
);
create table if not exists public.automation_rules(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 rule_key text not null,
 enabled boolean not null default true,
 config jsonb not null default '{}'::jsonb,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(company_id,rule_key)
);

-- Funciones de autorización seguras para políticas RLS
create or replace function public.is_company_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$
 select exists(select 1 from public.company_memberships m
   where m.company_id=p_company_id and m.user_id=auth.uid() and m.status='active');
$$;
create or replace function public.can_manage_company(p_company_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$
 select exists(select 1 from public.company_memberships m
   where m.company_id=p_company_id and m.user_id=auth.uid() and m.status='active'
   and m.role in ('owner','admin','manager'));
$$;
create or replace function public.is_company_admin(p_company_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$
 select exists(select 1 from public.company_memberships m
   where m.company_id=p_company_id and m.user_id=auth.uid() and m.status='active'
   and m.role in ('owner','admin'));
$$;

-- Al crear empresa, asigna automáticamente al creador como propietario
create or replace function public.add_company_owner()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 insert into public.company_memberships(company_id,user_id,role,status)
 values(new.id,new.created_by,'owner','active')
 on conflict(company_id,user_id) do nothing;
 insert into public.company_module_settings(company_id,module_key,enabled)
 select new.id,k,true from unnest(array[
  'dashboard','pos','products','inventory','purchases','suppliers','customers',
  'cash','banking','credit','quotes','returns','expenses','sunat','reports',
  'users','audit','branches','settings','automation','notifications','backups',
  'offline_sync','integrations','industry_config'
 ]) as k on conflict(company_id,module_key) do nothing;
 return new;
end;
$$;
drop trigger if exists companies_add_owner on public.companies;
create trigger companies_add_owner after insert on public.companies
for each row execute function public.add_company_owner();

-- Auditoría de cambios para tablas operativas principales
create or replace function public.audit_company_change()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_company uuid; v_id text; v_old jsonb; v_new jsonb;
begin
 if tg_op='DELETE' then
   v_old:=to_jsonb(old);
   v_company:=(v_old->>'company_id')::uuid;
   v_id:=coalesce(v_old->>'id',v_old->>'sku','');
 else
   v_new:=to_jsonb(new);
   v_company:=(v_new->>'company_id')::uuid;
   v_id:=coalesce(v_new->>'id',v_new->>'sku','');
   if tg_op='UPDATE' then v_old:=to_jsonb(old); end if;
 end if;
 insert into public.audit_logs(company_id,actor_id,action,table_name,record_id,old_data,new_data)
 values(v_company,auth.uid(),tg_op,tg_table_name,v_id,v_old,v_new);
 return coalesce(new,old);
end;
$$;
drop trigger if exists products_audit_change on public.products;
create trigger products_audit_change after insert or update or delete on public.products
for each row execute function public.audit_company_change();
drop trigger if exists suppliers_audit_change on public.suppliers;
create trigger suppliers_audit_change after insert or update or delete on public.suppliers
for each row execute function public.audit_company_change();
drop trigger if exists purchases_audit_change on public.purchases;
create trigger purchases_audit_change after insert or update or delete on public.purchases
for each row execute function public.audit_company_change();
drop trigger if exists expenses_audit_change on public.expenses;
create trigger expenses_audit_change after insert or update or delete on public.expenses
for each row execute function public.audit_company_change();

-- RLS en todas las tablas con datos empresariales
alter table public.sales enable row level security;
alter table public.customers enable row level security;
alter table public.business_records enable row level security;
alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;
alter table public.branches enable row level security;
alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
alter table public.expenses enable row level security;
alter table public.quotes enable row level security;
alter table public.receivables enable row level security;
alter table public.audit_logs enable row level security;
alter table public.company_module_settings enable row level security;
alter table public.automation_rules enable row level security;

-- Sustituir políticas de prototipo por políticas compatibles con membresía de empresa
drop policy if exists "Users manage their own sales" on public.sales;
drop policy if exists sales_company_access on public.sales;
create policy sales_company_access on public.sales for all to authenticated
 using(user_id=auth.uid() or (company_id is not null and public.is_company_member(company_id)))
 with check(user_id=auth.uid() or (company_id is not null and public.is_company_member(company_id)));
drop policy if exists "Users manage their own customers" on public.customers;
drop policy if exists customers_company_access on public.customers;
create policy customers_company_access on public.customers for all to authenticated
 using(user_id=auth.uid() or (company_id is not null and public.is_company_member(company_id)))
 with check(user_id=auth.uid() or (company_id is not null and public.is_company_member(company_id)));
drop policy if exists "Users manage their own business records" on public.business_records;
drop policy if exists business_records_company_access on public.business_records;
create policy business_records_company_access on public.business_records for all to authenticated
 using(user_id=auth.uid() or (company_id is not null and public.is_company_member(company_id)))
 with check(user_id=auth.uid() or (company_id is not null and public.is_company_member(company_id)));

drop policy if exists companies_member_read on public.companies;
create policy companies_member_read on public.companies for select to authenticated using(public.is_company_member(id));
drop policy if exists companies_owner_create on public.companies;
create policy companies_owner_create on public.companies for insert to authenticated with check(created_by=auth.uid());
drop policy if exists companies_admin_update on public.companies;
create policy companies_admin_update on public.companies for update to authenticated
 using(public.is_company_admin(id)) with check(public.is_company_admin(id));
drop policy if exists companies_admin_delete on public.companies;
create policy companies_admin_delete on public.companies for delete to authenticated using(public.is_company_admin(id));

drop policy if exists memberships_read on public.company_memberships;
create policy memberships_read on public.company_memberships for select to authenticated
 using(user_id=auth.uid() or public.is_company_admin(company_id));
drop policy if exists memberships_admin_insert on public.company_memberships;
create policy memberships_admin_insert on public.company_memberships for insert to authenticated
 with check(public.is_company_admin(company_id));
drop policy if exists memberships_admin_update on public.company_memberships;
create policy memberships_admin_update on public.company_memberships for update to authenticated
 using(public.is_company_admin(company_id)) with check(public.is_company_admin(company_id));
drop policy if exists memberships_admin_delete on public.company_memberships;
create policy memberships_admin_delete on public.company_memberships for delete to authenticated
 using(public.is_company_admin(company_id) and user_id<>auth.uid());

-- Políticas por empresa: miembros leen; owner/admin/manager modifican
do $$
declare t text;
begin
 foreach t in array array['branches','products','inventory_movements','suppliers','purchases','purchase_items',
  'cash_sessions','cash_movements','expenses','quotes','receivables','company_module_settings','automation_rules'] loop
  execute format('drop policy if exists %I on public.%I',t||'_member_read',t);
  execute format('create policy %I on public.%I for select to authenticated using(public.is_company_member(company_id))',t||'_member_read',t);
  execute format('drop policy if exists %I on public.%I',t||'_manager_insert',t);
  execute format('create policy %I on public.%I for insert to authenticated with check(public.can_manage_company(company_id))',t||'_manager_insert',t);
  execute format('drop policy if exists %I on public.%I',t||'_manager_update',t);
  execute format('create policy %I on public.%I for update to authenticated using(public.can_manage_company(company_id)) with check(public.can_manage_company(company_id))',t||'_manager_update',t);
  execute format('drop policy if exists %I on public.%I',t||'_manager_delete',t);
  execute format('create policy %I on public.%I for delete to authenticated using(public.can_manage_company(company_id))',t||'_manager_delete',t);
 end loop;
end $$;

drop policy if exists audit_member_read on public.audit_logs;
create policy audit_member_read on public.audit_logs for select to authenticated using(public.is_company_admin(company_id));
drop policy if exists audit_manager_insert on public.audit_logs;
create policy audit_manager_insert on public.audit_logs for insert to authenticated with check(public.is_company_member(company_id));
drop policy if exists audit_no_update on public.audit_logs;
create policy audit_no_update on public.audit_logs for update to authenticated using(false) with check(false);
drop policy if exists audit_no_delete on public.audit_logs;
create policy audit_no_delete on public.audit_logs for delete to authenticated using(false);

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.sales,public.customers,public.business_records,
 public.companies,public.company_memberships,public.branches,public.products,public.inventory_movements,
 public.suppliers,public.purchases,public.purchase_items,public.cash_sessions,public.cash_movements,
 public.expenses,public.quotes,public.receivables,public.audit_logs,public.company_module_settings,
 public.automation_rules to authenticated;
grant usage,select on sequence public.audit_logs_id_seq to authenticated;

-- Importante: este esquema proporciona aislamiento por empresa dentro de una instancia PostgreSQL.
-- La creación de bases físicas independientes requiere una API privada/servicio backend con credenciales
-- de servidor y no se debe implementar desde el navegador.
