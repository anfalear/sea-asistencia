-- ============================================================
--  SEA Matemáticas UIS · Esquema de base de datos
--  Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- Extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
--  TABLA: estudiantes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.estudiantes (
    id                UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
    codigo_estudiante VARCHAR(20) UNIQUE NOT NULL,
    nombre_completo   VARCHAR(150) NOT NULL,
    curso_grupo       VARCHAR(50)  NOT NULL,
    tipo_curso        VARCHAR(25)  NOT NULL
        CHECK (tipo_curso IN ('Didáctica del Cálculo', 'Refuerzo SEA')),
    profesor_email    VARCHAR(100) NOT NULL,
    activo            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
--  TABLA: asistencias  (resumen por sesión)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.asistencias (
    id                UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
    fecha             DATE        NOT NULL,
    profesor_email    VARCHAR(100) NOT NULL,
    curso_grupo       VARCHAR(50)  NOT NULL,
    tipo_curso        VARCHAR(25)  NOT NULL
        CHECK (tipo_curso IN ('Didáctica del Cálculo', 'Refuerzo SEA')),
    presentes         INTEGER      NOT NULL DEFAULT 0 CHECK (presentes >= 0),
    ausentes          INTEGER      NOT NULL DEFAULT 0 CHECK (ausentes >= 0),
    alerta_precalculo BOOLEAN      NOT NULL DEFAULT FALSE,
    alerta_psicologia BOOLEAN      NOT NULL DEFAULT FALSE,
    observaciones     TEXT,
    timestamp         TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (fecha, curso_grupo)
);

-- ============================================================
--  TABLA: detalle_asistencias  (asistencia individual)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.detalle_asistencias (
    id             UUID    DEFAULT uuid_generate_v4() PRIMARY KEY,
    asistencia_id  UUID    NOT NULL REFERENCES public.asistencias(id)  ON DELETE CASCADE,
    estudiante_id  UUID    NOT NULL REFERENCES public.estudiantes(id)  ON DELETE CASCADE,
    presente       BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (asistencia_id, estudiante_id)
);

-- ============================================================
--  ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_est_grupo         ON public.estudiantes(curso_grupo);
CREATE INDEX IF NOT EXISTS idx_est_profesor      ON public.estudiantes(profesor_email);
CREATE INDEX IF NOT EXISTS idx_est_tipo          ON public.estudiantes(tipo_curso);
CREATE INDEX IF NOT EXISTS idx_asis_fecha        ON public.asistencias(fecha);
CREATE INDEX IF NOT EXISTS idx_asis_profesor     ON public.asistencias(profesor_email);
CREATE INDEX IF NOT EXISTS idx_asis_grupo        ON public.asistencias(curso_grupo);
CREATE INDEX IF NOT EXISTS idx_asis_alertas      ON public.asistencias(alerta_precalculo, alerta_psicologia);
CREATE INDEX IF NOT EXISTS idx_detalle_asis_id   ON public.detalle_asistencias(asistencia_id);

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.estudiantes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_asistencias  ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
--  Políticas: estudiantes
-- ------------------------------------------------------------
CREATE POLICY "est_select" ON public.estudiantes
    FOR SELECT TO authenticated
    USING (
        profesor_email = (auth.jwt() ->> 'email')
        OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    );

CREATE POLICY "est_insert" ON public.estudiantes
    FOR INSERT TO authenticated
    WITH CHECK (
        profesor_email = (auth.jwt() ->> 'email')
        OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    );

CREATE POLICY "est_update" ON public.estudiantes
    FOR UPDATE TO authenticated
    USING (
        profesor_email = (auth.jwt() ->> 'email')
        OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    );

CREATE POLICY "est_delete" ON public.estudiantes
    FOR DELETE TO authenticated
    USING (
        (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    );

-- ------------------------------------------------------------
--  Políticas: asistencias
-- ------------------------------------------------------------
CREATE POLICY "asis_select" ON public.asistencias
    FOR SELECT TO authenticated
    USING (
        profesor_email = (auth.jwt() ->> 'email')
        OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    );

CREATE POLICY "asis_insert" ON public.asistencias
    FOR INSERT TO authenticated
    WITH CHECK (
        profesor_email = (auth.jwt() ->> 'email')
        OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    );

CREATE POLICY "asis_update" ON public.asistencias
    FOR UPDATE TO authenticated
    USING (
        profesor_email = (auth.jwt() ->> 'email')
        OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    );

CREATE POLICY "asis_delete" ON public.asistencias
    FOR DELETE TO authenticated
    USING (
        (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
    );

-- ------------------------------------------------------------
--  Políticas: detalle_asistencias
-- ------------------------------------------------------------
CREATE POLICY "detalle_select" ON public.detalle_asistencias
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.asistencias a
            WHERE a.id = asistencia_id
              AND (
                    a.profesor_email = (auth.jwt() ->> 'email')
                    OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
                  )
        )
    );

CREATE POLICY "detalle_insert" ON public.detalle_asistencias
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.asistencias a
            WHERE a.id = asistencia_id
              AND (
                    a.profesor_email = (auth.jwt() ->> 'email')
                    OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
                  )
        )
    );

CREATE POLICY "detalle_delete" ON public.detalle_asistencias
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.asistencias a
            WHERE a.id = asistencia_id
              AND (
                    a.profesor_email = (auth.jwt() ->> 'email')
                    OR (auth.jwt() ->> 'email') = 'aflaok10@gmail.com'
                  )
        )
    );
