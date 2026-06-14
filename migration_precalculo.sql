-- ============================================================
--  Migración: Renombrar "Didáctica del Cálculo" → "Precálculo"
--  Ejecutar en Supabase > SQL Editor
--  IMPORTANTE: ejecutar antes de desplegar el nuevo código
-- ============================================================

-- 1. Migrar datos existentes
UPDATE public.estudiantes
SET tipo_curso = 'Precálculo'
WHERE tipo_curso = 'Didáctica del Cálculo';

UPDATE public.asistencias
SET tipo_curso = 'Precálculo'
WHERE tipo_curso = 'Didáctica del Cálculo';

-- 2. Actualizar CHECK constraints (los nombres son los generados por PostgreSQL)
ALTER TABLE public.estudiantes DROP CONSTRAINT IF EXISTS estudiantes_tipo_curso_check;
ALTER TABLE public.estudiantes ADD CONSTRAINT estudiantes_tipo_curso_check
    CHECK (tipo_curso IN ('Precálculo', 'Refuerzo SEA'));

ALTER TABLE public.asistencias DROP CONSTRAINT IF EXISTS asistencias_tipo_curso_check;
ALTER TABLE public.asistencias ADD CONSTRAINT asistencias_tipo_curso_check
    CHECK (tipo_curso IN ('Precálculo', 'Refuerzo SEA'));

-- 3. Crear tabla de lista blanca para Google OAuth
--    (si ya existe, omitir este bloque)
CREATE TABLE IF NOT EXISTS public.email_whitelist (
    email VARCHAR(150) PRIMARY KEY
);

-- RLS: solo usuarios autenticados pueden leer su propio email en la whitelist
ALTER TABLE public.email_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "whitelist_select" ON public.email_whitelist
    FOR SELECT TO authenticated
    USING (true);

-- 4. Insertar los emails autorizados (edita esta lista según necesites)
INSERT INTO public.email_whitelist (email) VALUES
 ('aflaok10@gmail.com'),
('profesor1@uis.edu.co'),
('profesor2@uis.edu.co');

-- ============================================================
--  Verificación: ejecuta estas consultas para confirmar
-- ============================================================
SELECT tipo_curso, COUNT(*) FROM public.estudiantes GROUP BY tipo_curso;
SELECT tipo_curso, COUNT(*) FROM public.asistencias  GROUP BY tipo_curso;
SELECT * FROM public.email_whitelist;
