# SEA Matemáticas UIS · Arquitectura del sistema

Documento de referencia para retomar o extender la app sin tener que releer todo el código. Describe qué es, cómo está construida, cómo se despliega y qué convenciones sigue.

## Qué es

Sistema de registro de asistencia, evaluación de talleres, alertas de seguimiento e informes de cierre de periodo para el programa **SEA Matemáticas** (Universidad Industrial de Santander), cursos **Precálculo** y **Refuerzo SEA**. Reemplaza planillas sueltas: cada profesor ve y edita únicamente los grupos asignados a su correo; el administrador ve todo.

## Stack

- **Frontend**: HTML + CSS + JavaScript "vanilla" (sin framework, sin build step). Un solo `index.html`, módulos JS cargados como `<script>` planos que comparten el `window` global.
- **Backend**: [Supabase](https://supabase.com) — Postgres gestionado + Auth + API autogenerada (PostgREST). No hay servidor propio.
- **Librerías por CDN** (`index.html`, sin bundler): `@supabase/supabase-js@2`, `xlsx` (SheetJS, para import/export Excel), `chart.js` (gráfico de asistencia por estudiante).
- **Hosting**: GitHub Pages, sirviendo directamente el contenido del repo (`main` branch) en `https://anfalear.github.io/sea-asistencia/`.
- **Repo**: `github.com/anfalear/sea-asistencia`.

No hay `package.json`, `npm install` ni proceso de build: se edita el HTML/CSS/JS directamente y se hace `git push` a `main`, que GitHub Pages despliega automáticamente.

## Estructura de archivos

```
index.html              Toda la SPA: pantallas de login/app, las 6 vistas, todos los modales
guia.html                Guía de uso para profesores (independiente, enlazada desde el login)
css/styles.css           Único stylesheet, variables CSS en :root
js/
  config.js               URL/anon key de Supabase + ADMIN_EMAIL (cargado, es la fuente real)
  env.js, env.example.js  Plantilla de credenciales — NO están enlazados en index.html, no se usan
  auth.js                 Login con Google + verificación contra email_whitelist
  main.js                 Bootstrap: initAuth() al cargar el DOM
  ui.js                   Router de vistas (navigateTo), toasts, modal genérico, helpers
  dashboard.js             Vista Dashboard (solo lectura)
  registro.js               Vista Registro de Asistencia (la más grande — captura todo por sesión)
  historial.js              Vista Historial (consulta por rango de fechas/grupo)
  estudiantes.js             Vista Estudiantes (CRUD + filtros)
  informe_estudiante.js       Vista Informes (upsert por estudiante+periodo)
  alertas.js                  Vista Alertas (dos pestañas: Didáctica / Psicología)
  estadisticas.js              Modal de estadísticas de asistencia por estudiante (doughnut chart)
  importador.js                 Modal de importación masiva desde Excel SIAE (solo admin)
  export.js                     Genera el .xlsx de Historial (4 hojas)
schema.sql                Definición base de tablas + RLS (desactualizado, ver "Deuda técnica")
migration_precalculo.sql  Renombre de tipo_curso + creación de email_whitelist
migration_alerts.sql      Mueve alertas/observación de asistencias → detalle_asistencias (por estudiante)
migration_informes.sql    Tabla informes_estudiante + RLS + GRANT
seed_datos_prueba.sql     Datos ficticios para pruebas del admin (grupos MAT-A1/MAT-B1/REF-A1)
CAMBIOS_PENDIENTES.md     Registro histórico de un plan de cambios ya aplicado (puntajes de taller + informes)
```

**Convención de carga de scripts**: `index.html` incluye cada JS con un query param de versión, p. ej. `js/registro.js?v=5`. GitHub Pages no hashea nombres de archivo, así que **cada vez que se modifica un JS, hay que subir su `?v=N`** en `index.html`, o los navegadores servirán la versión cacheada.

## Modelo de datos (Supabase / Postgres, esquema `public`)

### `estudiantes`
Un registro por estudiante, con su grupo y profesor asignado.

Columnas en `schema.sql`: `id (uuid pk)`, `codigo_estudiante (varchar unique)`, `nombre_completo`, `curso_grupo`, `tipo_curso` (`CHECK IN ('Precálculo','Refuerzo SEA')`), `profesor_email`, `activo (bool)`, `created_at`.

Columnas añadidas después, **directamente en Supabase, sin migración versionada** (ver Deuda técnica): `email`, `direccion_electron`, `telefono_reside` (usadas por el importador SIAE y el export), y `programa_academico`, `ciudad_procedencia`, `fecha_nacimiento` (documentadas en `CAMBIOS_PENDIENTES.md`, todas nullable/opcionales).

### `asistencias`
Un registro por **sesión** (fecha + grupo): `id`, `fecha`, `profesor_email`, `curso_grupo`, `tipo_curso`, `presentes`, `ausentes`, `timestamp`. `UNIQUE (fecha, curso_grupo)` — por eso `registro.js` hace upsert manual (busca existente, actualiza o inserta).

Las columnas `alerta_precalculo`, `alerta_psicologia`, `observaciones` que aparecen en `schema.sql` para esta tabla **ya no existen**: `migration_alerts.sql` las movió a `detalle_asistencias` para que la alerta sea por estudiante, no por sesión completa.

### `detalle_asistencias`
Un registro por **estudiante × sesión**: `id`, `asistencia_id (fk)`, `estudiante_id (fk)`, `presente (bool)`. `UNIQUE (asistencia_id, estudiante_id)`.

Columnas añadidas por migraciones posteriores: `alerta_precalculo`, `alerta_psicologia`, `observacion` (`migration_alerts.sql`); `numero_taller`, `comunicacion`, `procedimientos`, `representacion`, `razonamiento` (puntajes 1–5, `CAMBIOS_PENDIENTES.md`, aplicadas manualmente).

`registro.js` borra y reinserta todas las filas de `detalle_asistencias` de una sesión al guardar (`DELETE ... WHERE asistencia_id = X` seguido de `INSERT`), en vez de hacer upsert fila por fila.

### `informes_estudiante`
Un informe de cierre por estudiante+periodo: `id`, `estudiante_id (fk)`, `periodo (varchar, texto libre tipo "2026-1")`, `desempeno_general (text)`, `profesor_email`, `created_at`. `UNIQUE (estudiante_id, periodo)` — upsert con `onConflict: 'estudiante_id, periodo'`.

### `email_whitelist`
Lista blanca de correos autorizados a iniciar sesión: `email (varchar pk)`. Creada en `migration_precalculo.sql`. Es la puerta de entrada real de la app — sin fila aquí, `auth.js` cierra la sesión automáticamente aunque Google haya autenticado al usuario.

### Seguridad: RLS, no roles de Postgres

Todas las tablas tienen RLS activado. El patrón se repite en las 4 tablas de datos (`estudiantes`, `asistencias`, `detalle_asistencias` vía join, `informes_estudiante`):

- **SELECT/INSERT/UPDATE**: permitido si `profesor_email = auth.jwt()->>'email'`, **o** si el email es el admin (`aflaok10@gmail.com`, hardcodeado en cada policy).
- **DELETE**: solo el admin.

No existe un rol "profesor" en Postgres ni una columna de rol en una tabla de usuarios: el "rol" es 100% client-side (`isAdmin = user.email === ADMIN_EMAIL` en `config.js`) usado solo para **mostrar/ocultar botones** (crear estudiante, importar Excel). La seguridad real vive en las policies RLS, comparando el email del JWT contra `profesor_email` fila por fila.

**Importante para nuevas features**: cualquier tabla nueva que guarde datos por profesor necesita su propio set de 4 policies (select/insert/update/delete) siguiendo este mismo patrón, y su `GRANT` explícito a `authenticated` — el error típico si se olvida el GRANT es "permission denied for table X" (ver `migration_informes.sql`, que existió específicamente para arreglar eso).

## Autenticación

`js/auth.js`:
1. Login vía `db.auth.signInWithOAuth({ provider: 'google' })` (redirect, no popup).
2. Se suscribe a `onAuthStateChange` **antes** de cualquier otra llamada (evita condición de carrera con el flujo PKCE de OAuth).
3. Al recibir sesión, valida el email contra `email_whitelist`. Si no está, fuerza `signOut()` inmediatamente y muestra "Tu cuenta no está autorizada."
4. `config.js` define `ADMIN_EMAIL`; `setCurrentUser()` calcula `isAdmin` comparando contra ese valor.

No hay contraseñas propias ni tabla de usuarios de la app — la identidad es 100% Google + Supabase Auth, y la autorización es la whitelist + RLS.

## Vistas de la app (`ui.js` → `navigateTo`)

Router simple sin URL routing (no usa `#hash` ni History API): `navigateTo(view)` oculta/muestra secciones `.view` por `id` y llama al `init*`/`load*` correspondiente.

| Vista | Función de entrada | Notas |
|---|---|---|
| `dashboard` | `loadDashboard()` | Solo lectura: contadores + actividad reciente + alertas de 30 días |
| `registro` | `initRegistro()` | Flujo: elegir fecha+grupo → `cargarGrupo()` trae estudiantes + registro existente si lo hay → editar tarjetas → `guardarAsistencia()` hace upsert de sesión + reemplazo total del detalle |
| `historial` | `initHistorial()` | Filtro por rango de fechas/grupo; botón exporta vía `export.js` |
| `estudiantes` | `initEstudiantes()` | CRUD; botones "Nuevo"/"Importar" solo visibles si `isAdmin` |
| `informes` | `initInformes()` | Cascada grupo → estudiante → periodo; upsert en `informes_estudiante` |
| `alertas` | `loadAlertas()` | Dos queries independientes (`alerta_precalculo=true`, `alerta_psicologia=true`) sobre `detalle_asistencias` |

Modales (todos definidos en `index.html`, controlados por `classList.toggle('hidden')`): `modal-estudiante` (crear/editar), `modal-estadisticas` (chart por estudiante), `modal-importador` (SIAE), `modal-instructivo` (ayuda in-app, botón `? Instructivo` en la topbar).

## Convenciones de datos que hay que respetar

- `tipo_curso` solo acepta `'Precálculo'` o `'Refuerzo SEA'` (constraint en BD). El nombre viejo `'Didáctica del Cálculo'` fue renombrado por `migration_precalculo.sql` — si aparece en código o datos nuevos, es un bug.
- `curso_grupo` y `profesor_email` no tienen tabla propia: son texto libre en `estudiantes`/`asistencias`. Un "grupo" es simplemente el conjunto de estudiantes que comparten el mismo `curso_grupo`. Los selects de grupo (`cargarGruposEnSelect`) se arman con `SELECT DISTINCT curso_grupo FROM estudiantes WHERE activo=true` — un grupo sin estudiantes activos deja de aparecer en los selectores.
- `nombre_completo` se guarda en mayúsculas, formato `APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2` (ver `seed_datos_prueba.sql` e `importador.js`).
- `profesor_email` siempre en minúsculas (`.toLowerCase()` al guardar en `estudiantes.js`/`importador.js`); `curso_grupo` siempre en mayúsculas (`.toUpperCase()`).
- Los puntajes de taller (`comunicacion`, `procedimientos`, `representacion`, `razonamiento`) son 1–5, opcionales, sin validación de rango en el cliente más allá de `min`/`max` del `<input type="number">`.

## Diseño (`css/styles.css`)

Tokens en `:root`: color primario `#3a5bd9` (azul, usado en sidebar activo, badges, botones), fondo `#f0f4f8`, sidebar oscuro `#1b2340`. Semántica de badges: verde `--green` (bien/presente), rojo `--red` (alerta Didáctica/ausente), ámbar `--amber` (alerta Psicología), azul `--blue` (Precálculo) vs verde (Refuerzo SEA) para distinguir tipo de curso en tablas.

`guia.html` es una página aparte con su propio sistema de diseño (paper `#f4f6fc`, serif Georgia para headings, mono para referencias de UI) — intencionalmente distinto al de la app, porque es un documento de lectura, no una herramienta.

## Despliegue

1. Editar archivos localmente.
2. Si se tocó un `.js` enlazado en `index.html`, subir su `?v=N`.
3. `git add` (evitar commitear datos reales de estudiantes o llaves privadas — la anon key pública sí va commiteada intencionalmente, ver comentario en `config.js`).
4. `git commit` + `git push origin main`.
5. GitHub Pages redespliega solo, normalmente en uno o dos minutos, en `https://anfalear.github.io/sea-asistencia/`.

Cambios de esquema (nuevas columnas/tablas/policies) se ejecutan **manualmente en Supabase → SQL Editor**, no hay migraciones automáticas ni CLI de Supabase configurada en este repo. Cada `migration_*.sql` es un script que ya se corrió una vez; se conservan como historial, no se re-ejecutan.

## Deuda técnica / cosas a saber antes de tocar esto

- **`schema.sql` no refleja el estado real de la base de datos.** Le faltan `email`, `direccion_electron`, `telefono_reside` en `estudiantes` (usadas en `estudiantes.js`, `importador.js`, `export.js`) y las columnas de `migration_alerts.sql`/`migration_informes.sql`/`CAMBIOS_PENDIENTES.md`. Antes de asumir la forma de una tabla, conviene correr en Supabase:
  ```sql
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='estudiantes' ORDER BY ordinal_position;
  ```
- **`js/env.js` y `js/env.example.js` no están enlazados en `index.html`** — parecen un intento abandonado de separar credenciales, `js/config.js` es la fuente real y única. `env.js` está en `.gitignore`-like situación (no trackeado) pero no borrado; si se retoma esa separación, hay que decidir entre mantenerla o eliminar los archivos sueltos.
- El rol admin/profesor es un único email hardcodeado (`ADMIN_EMAIL` en `config.js` + repetido literal en cada policy RLS). Agregar un segundo administrador implica editar `config.js` **y** todas las policies en Supabase — no hay tabla de roles.
- No hay tests automatizados ni linter configurado.
