-- NOVA DIGITEX — esquema Supabase v2
-- Ejecutar en Supabase Dashboard > SQL Editor. Solo clave pública en el navegador.
create extension if not exists pgcrypto;
create table if not exists public.sales(id text primary key,user_id uuid not null references auth.users(id) on delete cascade,rubric_id text not null,rubric_name text not null,customer_name text not null default 'Público general',payment_method text not null,items jsonb not null default '[]'::jsonb,total numeric(12,2) not null check(total>=0),created_at timestamptz not null default now());
create index if not exists sales_user_created_idx on public.sales(user_id,created_at desc);
create table if not exists public.customers(id text primary key,user_id uuid not null references auth.users(id) on delete cascade,name text not null,document_number text,phone text,created_at timestamptz not null default now());
create index if not exists customers_user_name_idx on public.customers(user_id,name);
create table if not exists public.business_records(id text primary key,user_id uuid not null references auth.users(id) on delete cascade,rubric_id text not null,record_type text not null,payload jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create index if not exists business_records_user_rubric_idx on public.business_records(user_id,rubric_id,created_at desc);
alter table public.sales enable row level security;
alter table public.customers enable row level security;
alter table public.business_records enable row level security;
drop policy if exists "Users manage their own sales" on public.sales;
create policy "Users manage their own sales" on public.sales for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "Users manage their own customers" on public.customers;
create policy "Users manage their own customers" on public.customers for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "Users manage their own business records" on public.business_records;
create policy "Users manage their own business records" on public.business_records for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.sales,public.customers,public.business_records to authenticated;
-- Próxima fase de producción: tablas normalizadas para empresas/sucursales, roles,
-- catálogo/kardex, caja auditada, permisos, SUNAT y pruebas de sincronización multi-dispositivo.
