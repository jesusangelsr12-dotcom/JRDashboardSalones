-- ============================================
-- Migración: Agregar columna origen a movimientos_bolsa
-- ============================================
-- Ejecutar en Supabase SQL Editor.
--
-- Decisión de backfill: todos los registros existentes quedan como 'manual'
-- porque hasta ahora todos los movimientos persistidos en esta tabla fueron
-- creados manualmente desde el formulario "Movimiento de Bolsa".
-- Los gastos de Google Sheets NO se persisten en esta tabla (se cargan
-- en runtime desde la API de Sheets).
-- ============================================

ALTER TABLE movimientos_bolsa
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'manual';

ALTER TABLE movimientos_bolsa
  ADD CONSTRAINT chk_origen CHECK (origen IN ('manual', 'auto'));
