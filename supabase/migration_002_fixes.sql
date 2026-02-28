-- ============================================
-- Migration 002: Fix race conditions + constraints
-- ============================================
-- Ejecutar en Supabase SQL Editor DESPUÉS de schema.sql
-- ============================================

-- 1. Función RPC para actualizar acumulado atómicamente (evita race conditions)
--    Usa SET acumulado = acumulado + delta en vez de read-modify-write
CREATE OR REPLACE FUNCTION increment_acumulado(bolsa_uuid uuid, delta numeric)
RETURNS void AS $$
BEGIN
  UPDATE bolsas SET acumulado = acumulado + delta WHERE id = bolsa_uuid;
END;
$$ LANGUAGE plpgsql;

-- 2. Unique constraint en cierres para evitar doble cierre de la misma semana
--    (si ya existe el índice idx_cierres_semana, este constraint lo reemplaza)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cierres_salon_semana_unique'
  ) THEN
    ALTER TABLE cierres ADD CONSTRAINT cierres_salon_semana_unique
      UNIQUE (salon_id, semana_inicio);
  END IF;
END $$;

-- 3. Unique constraint en salones.nombre para evitar duplicados desde la BD
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salones_nombre_unique'
  ) THEN
    ALTER TABLE salones ADD CONSTRAINT salones_nombre_unique UNIQUE (nombre);
  END IF;
END $$;
