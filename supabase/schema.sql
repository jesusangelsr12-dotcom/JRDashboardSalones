-- ============================================
-- JR Consulting Dashboard - Supabase Schema
-- ============================================
-- Ejecutar este SQL en el SQL Editor de Supabase
-- (Dashboard → SQL Editor → New Query → Pegar → Run)
-- ============================================

-- 1. Tabla de salones
create table salones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  color text not null default '#2563EB',
  sheet_id text not null default '',
  bolsa_default_gastos_id uuid,
  created_at timestamptz not null default now()
);

-- 2. Tabla de bolsas (distribución de dinero)
create table bolsas (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  nombre text not null,
  porcentaje numeric not null default 0,
  color text not null default '#6366F1',
  acumulado numeric not null default 0
);

-- 3. Tabla de gastos fijos
create table gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  nombre text not null,
  monto numeric not null default 0,
  frecuencia text not null default 'mensual'
    check (frecuencia in ('semanal', 'mensual'))
);

-- 4. Tabla de cierres semanales
create table cierres (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  fecha text not null,
  semana_inicio text not null,
  semana_fin text not null,
  ingresos numeric not null default 0,
  gastos numeric not null default 0,
  libre numeric not null default 0,
  bolsas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 5. Tabla de gastos registrados desde la app de admin
create table gastos_admin (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  fecha date not null,
  descripcion text not null,
  monto numeric not null,
  metodo_pago text not null default 'Efectivo',
  bolsa_id uuid references bolsas(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 6. Tabla de movimientos manuales de bolsa (agregar/restar dinero)
create table movimientos_bolsa (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id) on delete cascade,
  bolsa_id uuid not null references bolsas(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  monto numeric not null,
  metodo_pago text not null default 'Efectivo',
  descripcion text not null default '',
  fecha date not null,
  created_at timestamptz not null default now()
);

-- 7. Índices para queries frecuentes
create index idx_bolsas_salon on bolsas(salon_id);
create index idx_gastos_fijos_salon on gastos_fijos(salon_id);
create index idx_cierres_salon on cierres(salon_id);
create index idx_cierres_semana on cierres(salon_id, semana_inicio);
create index idx_gastos_admin_salon on gastos_admin(salon_id);
create index idx_movimientos_bolsa_salon on movimientos_bolsa(salon_id);
create index idx_movimientos_bolsa_bolsa on movimientos_bolsa(bolsa_id);

-- 8. FK de bolsa_default_gastos_id (after bolsas table exists)
alter table salones
  add constraint fk_bolsa_default_gastos
  foreign key (bolsa_default_gastos_id) references bolsas(id) on delete set null;

-- 9. RLS deshabilitado por ahora (solo tú usas la app)
--    Cuando agregues auth, habilita RLS y crea policies:
--    alter table salones enable row level security;
--    create policy "Users can manage their salones" on salones
--      for all using (auth.uid() = user_id);
