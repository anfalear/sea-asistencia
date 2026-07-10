# Depuración de estudiantes que nunca asistieron

Guía para desactivar estudiantes desertores al cierre de un periodo, y —más importante— para no
desactivar a quien no lo merece. Escrito el 2026-07-10 a partir del primer intento de depuración
del periodo 2026-1.

## Regla de oro: desactivar, nunca borrar

`detalle_asistencias.estudiante_id` tiene `ON DELETE CASCADE` (`schema.sql:49`). **Borrar un
estudiante borra todo su historial de asistencias**, y con eso se desfiguran las estadísticas del
grupo. Depurar aquí significa siempre `UPDATE estudiantes SET activo = false`.

Qué hace `activo = false`:

| Efecto | Dónde |
|---|---|
| Desaparece de la planilla de Registro | `registro.js:92` |
| Desaparece del selector de Informes | `informe_estudiante.js:37` |
| Deja de contar en el Dashboard | `dashboard.js:22` |
| **Sigue visible** en Estudiantes, con badge gris | `estudiantes.js:116` |
| **Su historial de asistencias queda intacto** | — |

Es reversible con el botón "Activar". Guarda siempre los códigos que devuelve el `RETURNING` por si
hay que revertir en bloque.

**Escribe los informes de cierre ANTES de desactivar.** La vista Informes solo lista estudiantes
activos; después de desactivarlo no vas a poder seleccionarlo para dejar constancia del abandono.

## Las tres trampas de los datos

Las tres producen falsos positivos: estudiantes que la consulta ingenua marca como desertores sin
serlo. Las tres son reales, las tres se vieron en el periodo 2026-1.

### 1. Estudiantes matriculados a mitad de periodo

**La más peligrosa.** `guardarAsistencia()` (`registro.js`) borra todo el detalle de la sesión y lo
reinserta con la planilla **actual**. Cuando un profesor reabre una sesión vieja para corregirla,
los estudiantes matriculados *después* de esa sesión quedan estampados como **ausentes** en clases
a las que no podían haber ido.

Pasó en PRECÁLCULO-AV: 10 estudiantes creados el 2026-07-09 terminaron con `registros = 4`, es
decir con ausencias en las 3 sesiones anteriores a su matrícula, porque la profe reabrió las
sesiones para corregir una que no se había registrado. Tres de ellos (2262493, 2262390, 2262708)
habrían sido desactivados al día siguiente de inscribirlos.

**Mitigación**: contar solo sesiones con `a.fecha >= e.created_at::date`.

### 2. `profesor_email` mal escrito

Si el `profesor_email` de un estudiante no coincide **exacto** con el correo Google del profesor, la
RLS lo esconde de su vista. El profesor nunca lo ve en la planilla, así que nunca lo marca, así que
el estudiante acumula sesiones sin registro — o registros parciales si el typo se introdujo a mitad
de camino.

Pasó con `marylin...` vs `marilyn...` (i/y transpuestas): 2260980 y 2263591. Nicolás (2263591)
aparecía con 2 registros de 4 sesiones — esas 2 ausencias no significaban que faltó, significaban
que faltaban datos.

**Mitigación**: `veces_registrado` muy por debajo de `sesiones_del_grupo` es una señal de alarma, no
de deserción. Ver también el mismo problema sobre `curso_grupo` en la memoria del proyecto (grupos
duplicados por tilde/mayúsculas).

### 3. Grupos con pocas sesiones registradas

Faltar a la única sesión registrada no es deserción. En 2026-1, PRECÁLCULO-DM tenía 1 sesión y
PRECÁLCULO-LM 3, contra 4 de todos los demás. Sus porcentajes de "nunca vino" salían artificialmente
bajos (menos oportunidades de faltar a *todas*) y sus candidatos no eran comparables.

**Mitigación**: exigir un mínimo de sesiones válidas (4 funcionó bien). Y si un grupo tiene muchas
menos sesiones que el resto, preguntarle al profesor si está registrando.

## Consultas

### Paso 0 — Verificar que `created_at` sirve como fecha de matrícula

```sql
SELECT curso_grupo, min(fecha) AS primera_sesion, max(fecha) AS ultima_sesion
FROM asistencias GROUP BY curso_grupo ORDER BY curso_grupo;

SELECT curso_grupo, min(created_at::date) AS primer_alta, max(created_at::date) AS ultima_alta
FROM estudiantes GROUP BY curso_grupo ORDER BY curso_grupo;
```

Si en algún grupo la primera sesión es **anterior** al alta de sus estudiantes, `created_at` refleja
cuándo se cargó el Excel, no la matrícula, y el filtro del paso 1 dejaría a ese grupo entero fuera de
la depuración. En ese caso usa la fecha de la primera sesión del grupo como piso, en vez de
`created_at`, para los importados en el lote inicial.

### Paso 1 — Candidatos

Cero presencias en ≥4 sesiones posteriores a su matrícula. Este filtro excluye solo, sin listas
manuales, las tres trampas de arriba.

```sql
WITH candidatos AS (
  SELECT e.id, e.codigo_estudiante, e.nombre_completo, e.curso_grupo,
         count(*) FILTER (WHERE a.fecha >= e.created_at::date)                AS sesiones_validas,
         count(*) FILTER (WHERE a.fecha >= e.created_at::date AND d.presente) AS presencias
  FROM estudiantes e
  JOIN detalle_asistencias d ON d.estudiante_id = e.id
  JOIN asistencias        a ON a.id = d.asistencia_id
  WHERE e.activo
  GROUP BY e.id
  HAVING count(*) FILTER (WHERE a.fecha >= e.created_at::date AND d.presente) = 0
     AND count(*) FILTER (WHERE a.fecha >= e.created_at::date) >= 4
)
SELECT * FROM candidatos ORDER BY curso_grupo, nombre_completo;
```

Revisa el conteo por grupo antes de tocar nada. Define el umbral **antes** de ver los nombres: si lo
decides mirando la lista, terminas negociando caso por caso.

### Paso 2 — Desactivar

Con el mismo CTE, cambiando el `SELECT` final:

```sql
WITH candidatos AS ( /* ...idéntico al paso 1... */ )
UPDATE estudiantes SET activo = false
WHERE id IN (SELECT id FROM candidatos)
RETURNING codigo_estudiante, nombre_completo, curso_grupo;
```

Guarda la salida del `RETURNING`.

## Contexto para interpretar los números

En 2026-1, con 4 sesiones registradas, la deserción ("nunca vino ni una vez") fue de **~24% en
promedio**, con rango del 13% al 34% entre grupos. Con ~29 estudiantes por grupo, esa dispersión es
consistente con puro azar: **ningún grupo era un outlier real**. No busques explicaciones de horario
o de salón para un grupo con 34% cuando el promedio es 24% y n=29.

Cuidado también con confundir dos preguntas distintas:

- **"A la profe le llegan 18"** → conteo *por sesión*.
- **"29 asistieron alguna vez"** → conteo *acumulado de estudiantes distintos*.

No se contradicen: con asistencia rotativa, 29 estudiantes vivos producen ~18 en el salón cada día.
Para comparar contra lo que el profesor ve, usa el conteo por sesión:

```sql
SELECT a.fecha,
       count(*) FILTER (WHERE d.presente) AS presentes,
       count(*)                           AS en_planilla
FROM asistencias a
JOIN detalle_asistencias d ON d.asistencia_id = a.id
WHERE a.curso_grupo = 'PRECÁLCULO-AV'
GROUP BY a.fecha ORDER BY a.fecha;
```

Nota sobre `presente`: puede ser `NULL` si el profesor no tocó ninguno de los dos botones
(`registro.js:316`). `NULL` no es lo mismo que ausente. Si `veces_registrado > ausencias + presencias`
en algún grupo, hay planillas guardadas a medio llenar y los datos no sirven para depurar.

## Pendientes

- [ ] **Limpiar las filas espurias de AV**: los 10 estudiantes creados el 2026-07-09 tienen
      `detalle_asistencias` con `presente = false` para sesiones anteriores a su matrícula. Les infla
      el badge de inasistencias y la gráfica de estadísticas. Al borrarlas hay que **recalcular los
      contadores `presentes`/`ausentes` de `asistencias`**, que quedarían desincronizados.
- [x] **Arreglar la causa raíz** (2026-07-10): `cargarGrupo()` ya no muestra en la planilla a los
      estudiantes con `created_at` posterior a la fecha de la sesión, salvo que ya tengan registro en
      ella. Avisa con un toast cuántos ocultó, para que el profesor no crea que le faltan estudiantes.
- [x] **Eliminar el typo en la fuente** (2026-07-10): los campos de correo del profesor (importador y
      formulario de estudiante) autocompletan desde `email_whitelist`, y ambos formularios **rechazan
      el guardado** si el correo no está en la whitelist.
- [ ] **Botón de depuración en la vista Estudiantes** (opcional): filtro "sin asistencias" +
      desactivación en lote, para no depender de SQL manual cada semestre.
