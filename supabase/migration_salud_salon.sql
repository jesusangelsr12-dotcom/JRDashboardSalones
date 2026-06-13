-- ============================================
-- Módulo "Salud del Salón" — Fase 1 + 2
-- ============================================
-- Agrega:
--   • naturaleza a bolsas    (gasto_operativo / reserva / reparto)
--   • categoria  a gastos_fijos y gastos_admin (nomina/renta/insumos/servicios/otros)
-- Los gastos del Google Sheet quedan como variables (no llevan categoría).
-- Aditiva y segura: todas las columnas tienen DEFAULT, no rompen datos existentes.
-- Ejecutar en Supabase → SQL Editor → New Query → Run.
-- ============================================

-- 1. Naturaleza de la bolsa (cómo la trata la capa de Salud)
ALTER TABLE bolsas
  ADD COLUMN IF NOT EXISTS naturaleza text NOT NULL DEFAULT 'reparto'
    CHECK (naturaleza IN ('gasto_operativo', 'reserva', 'reparto'));

-- 2. Categoría de gastos fijos
ALTER TABLE gastos_fijos
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'otros'
    CHECK (categoria IN ('nomina', 'renta', 'insumos', 'servicios', 'otros'));

-- 3. Categoría de gastos admin
ALTER TABLE gastos_admin
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'otros'
    CHECK (categoria IN ('nomina', 'renta', 'insumos', 'servicios', 'otros'));
