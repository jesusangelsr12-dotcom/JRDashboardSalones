-- ============================================
-- Migración: Tabla movimientos_bolsa
-- ============================================
-- Ejecutar en Supabase SQL Editor si ya tienes la BD creada.

create table if not exists movimientos_bolsa (
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

create index if not exists idx_movimientos_bolsa_salon on movimientos_bolsa(salon_id);
create index if not exists idx_movimientos_bolsa_bolsa on movimientos_bolsa(bolsa_id);
