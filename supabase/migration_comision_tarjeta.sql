-- Agrega campo de comisión de terminal por tarjeta a cada salón
-- El valor es un porcentaje (ej: 3.5 = 3.5%)
ALTER TABLE salones ADD COLUMN IF NOT EXISTS comision_tarjeta numeric NOT NULL DEFAULT 0;
