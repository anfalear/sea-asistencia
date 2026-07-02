# Plan de cambios frontend — SEA Matemáticas UIS

Extensión de la app para soportar evaluación de talleres e informes de cierre de periodo.
La migración SQL ya fue ejecutada en Supabase. Solo se modifica el frontend.

## Columnas nuevas ya disponibles en BD

**`estudiantes`** (nullable): `programa_academico VARCHAR(150)`, `ciudad_procedencia VARCHAR(100)`, `fecha_nacimiento DATE`

**`detalle_asistencias`** (nullable): `numero_taller SMALLINT`, `comunicacion SMALLINT 1-5`, `procedimientos SMALLINT 1-5`, `representacion SMALLINT 1-5`, `razonamiento SMALLINT 1-5`
(`observacion TEXT` ya existía, se reutiliza)

**`informes_estudiante`** (tabla nueva): `id UUID PK`, `estudiante_id UUID FK`, `periodo VARCHAR(20)`, `desempeno_general TEXT`, `profesor_email VARCHAR(100)`, `created_at TIMESTAMPTZ`, `UNIQUE(estudiante_id, periodo)`

## Reglas de negocio

- Todos los campos nuevos son opcionales. Sin validación bloqueante.
- `numero_taller` es libre (el profesor lo escribe), no se calcula por fecha ni se fuerza secuencia.
- `observacion` es un campo de texto libre; solo cambia la etiqueta visible.
- `informes_estudiante` se llena una vez por estudiante por periodo, flujo separado del registro diario.
- `alerta_precalculo` y `alerta_psicologia` no cambian de comportamiento.

---

## Lista atómica de cambios

### `index.html`

- [x] **Cambio 1** — Agregar input `#reg-num-taller` en la cabecera de sesión (`#registro-form-container`, antes de la lista de estudiantes). `type="number"` min=1 max=99, opcional. Etiqueta: "Taller (valor sugerido para el grupo · editable por estudiante abajo)". Es solo un valor por defecto para pre-llenar las tarjetas; no se lee al guardar.

- [x] **Cambio 2** — Agregar 3 campos al modal `#modal-estudiante`: `programa_academico` (texto), `ciudad_procedencia` (texto), `fecha_nacimiento` (date). Todos opcionales, sin validación bloqueante.

- [x] **Cambio 3** — Agregar enlace "Informes" en el sidebar para navegar a `#view-informes`.

- [x] **Cambio 4** — Agregar sección `#view-informes`: selector de grupo → selector de estudiante → input de periodo (ej. "2026-1") → textarea `desempeno_general` → botón Guardar. Incluir mensaje de confirmación si ya existe un informe para ese estudiante+periodo.

### `registro.js`

- [x] **Cambio 5** — `renderStudentList()`:
  - Re-etiquetar `observacion` a "Fortalezas, dificultades y observaciones del estudiante en esta sesión".
  - Agregar input `numero_taller` POR TARJETA (además de los 4 puntajes). Si el detalle ya tiene valor guardado, usarlo; si no, pre-llenar con el valor actual de `#reg-num-taller` como sugerencia editable.
  - Agregar 4 inputs numéricos 1-5 por tarjeta: `comunicacion`, `procedimientos`, `representacion`, `razonamiento`. Pre-llenar desde `detalle_asistencias` si hay registro previo.

- [x] **Cambio 6** — `cargarGrupo()`:
  - Ampliar el `.select(...)` de `detalle_asistencias` para incluir `numero_taller, comunicacion, procedimientos, representacion, razonamiento`.
  - Tras cargar, rellenar `#reg-num-taller` con el valor del primer detalle existente que tenga ese campo no nulo.

- [x] **Cambio 7** — `captureCurrentState()`: extraer `numero_taller` y los 4 puntajes de cada tarjeta (`parseInt`, `null` si vacío).

- [x] **Cambio 8** — `guardarAsistencia()`:
  - Leer `numero_taller` del input individual de cada tarjeta (NO de `#reg-num-taller`).
  - Incluir `numero_taller`, `comunicacion`, `procedimientos`, `representacion`, `razonamiento` en cada objeto de `detallePayload`.
  - `#reg-num-taller` solo participa en el renderizado (Cambio 5), nunca en el guardado.

### `estudiantes.js`

- [x] **Cambio 9** — `editarEstudiante()`: leer `data.programa_academico`, `data.ciudad_procedencia`, `data.fecha_nacimiento` y asignarlos a los inputs nuevos del modal.

- [x] **Cambio 10** — `guardarEstudiante()`: agregar `programa_academico`, `ciudad_procedencia`, `fecha_nacimiento` al objeto `payload`.

### `importador.js`

- [x] **Cambio 11** — `ejecutarImportacion()`: agregar `programa_academico: r.programa || null` al payload de upsert. El campo ya se extrae en `procesarArchivoSIAE()` y vive en `_importPreview`; solo falta incluirlo en el upsert. Una sola línea.

### `export.js`

- [x] **Cambio 12** — `exportarAsistencias()` — query: ampliar el `.select(...)` de `detalle_asistencias` para incluir `numero_taller, comunicacion, procedimientos, representacion, razonamiento`. Agregar segunda query independiente para traer `informes_estudiante` del mismo rango de grupos/período.

- [x] **Cambio 13** — `exportarAsistencias()` — construcción del libro: reemplazar la lógica de una sola hoja por 4 hojas:
  - Hoja 1 `Asistencia` — igual a la actual.
  - Hoja 2 `Puntajes` — estudiante, fecha, numero_taller, comunicacion, procedimientos, representacion, razonamiento.
  - Hoja 3 `Bitácora` — estudiante, fecha, numero_taller, observacion.
  - Hoja 4 `Informes` — estudiante, periodo, desempeno_general (una fila por estudiante).

### `informe_estudiante.js` (archivo nuevo)

- [x] **Cambio 14** — Crear archivo con 3 funciones:
  - `initInformes()` — carga grupos en el selector, conecta eventos.
  - `cargarInforme(estudianteId, periodo)` — busca en `informes_estudiante` si ya existe registro; si existe, pre-llena el textarea.
  - `guardarInforme()` — upsert a `informes_estudiante` con `onConflict: 'estudiante_id, periodo'`; muestra confirmación.

---

## Estado

- Cambio 1 aplicado en sesión 2026-07-01.
- Cambios 2-14 aplicados en sesión 2026-07-01. Pendiente: probar en navegador contra Supabase real y verificar migración (columnas/tabla) antes de dar por cerrado.
