-- ============================================================
--  Migración: Alertas por estudiante
--  Mueve alerta_precalculo, alerta_psicologia y observaciones
--  de asistencias (sesión) → detalle_asistencias (estudiante).
--  Ejecutar en Supabase > SQL Editor ANTES de desplegar el código.
-- ============================================================

-- 1. Agregar columnas de alerta a detalle_asistencias
ALTER TABLE public.detalle_asistencias
  ADD COLUMN IF NOT EXISTS alerta_precalculo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alerta_psicologia BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS observacion TEXT;

-- 2. Eliminar columnas de alerta de asistencias
ALTER TABLE public.asistencias
  DROP COLUMN IF EXISTS alerta_precalculo,
  DROP COLUMN IF EXISTS alerta_psicologia,
  DROP COLUMN IF EXISTS observaciones;

-- 3. Asegurar permisos completos en detalle_asistencias
GRANT SELECT, INSERT, UPDATE, DELETE ON public.detalle_asistencias TO authenticated;

-- ============================================================
--  Verificación: ejecuta esta consulta para confirmar
-- ============================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'detalle_asistencias'
ORDER BY ordinal_position;
