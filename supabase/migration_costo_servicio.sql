-- ============================================
-- Migración: Agregar es_costo_servicio a movimientos_bolsa
-- ============================================
-- Ejecutar en Supabase SQL Editor.
--
-- Permite marcar egresos como "producto consumido en servicio"
-- (tinte, químicos, herramientas usadas en clientas).
-- Solo aplica a egresos — el CHECK constraint lo garantiza.
-- ============================================

ALTER TABLE movimientos_bolsa
  ADD COLUMN IF NOT EXISTS es_costo_servicio boolean NOT NULL DEFAULT false;

ALTER TABLE movimientos_bolsa
  ADD CONSTRAINT chk_costo_solo_egresos
  CHECK (es_costo_servicio = false OR tipo = 'egreso');
