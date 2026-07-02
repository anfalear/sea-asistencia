-- ============================================================
--  Migración: Permisos para informes_estudiante
--  La tabla informes_estudiante y las columnas nuevas de
--  estudiantes/detalle_asistencias ya fueron creadas manualmente,
--  pero faltan RLS + GRANT (por eso "permission denied for table
--  informes_estudiante"). Ejecutar en Supabase > SQL Editor.
-- ============================================================

-- 1. Asegurar que la tabla existe con la forma esperada
--    (no-op si ya existe con estas columnas)
CREATE TABLE IF NOT EXISTS public.informes_estudiante (
    id                 UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
    estudiante_id      UUID         NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
    periodo            VARCHAR(20)  NOT NULL,
    desempeno_general  TEXT,
    profesor_email     VARCHAR(100),
    created_at         TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (estudiante_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_informes_estudiante_id ON public.informes_estudiante(estudiante_id);

-- 2. Row Level Security
ALTER TABLE public.informes_estudiante ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "informes_select" ON public.informes_estudiante;
CREATE POLICY "informes_select" ON public.informes_estudiante
    FOR SELECT TO authenticated
    USING (
        profesor_email = (auth.jwt() ->> 'email')
        OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    );

DROP POLICY IF EXISTS "informes_insert" ON public.informes_estudiante;
CREATE POLICY "informes_insert" ON public.informes_estudiante
    FOR INSERT TO authenticated
    WITH CHECK (
        profesor_email = (auth.jwt() ->> 'email')
        OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    );

DROP POLICY IF EXISTS "informes_update" ON public.informes_estudiante;
CREATE POLICY "informes_update" ON public.informes_estudiante
    FOR UPDATE TO authenticated
    USING (
        profesor_email = (auth.jwt() ->> 'email')
        OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    )
    WITH CHECK (
        profesor_email = (auth.jwt() ->> 'email')
        OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    );

DROP POLICY IF EXISTS "informes_delete" ON public.informes_estudiante;
CREATE POLICY "informes_delete" ON public.informes_estudiante
    FOR DELETE TO authenticated
    USING (
        (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    );

-- 3. Permisos de tabla (esto es lo que falta cuando el error es
--    "permission denied for table", a diferencia de un error de RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.informes_estudiante TO authenticated;

-- ============================================================
--  Verificación
-- ============================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'informes_estudiante';
