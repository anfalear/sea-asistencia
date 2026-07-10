// ============================================================
//  SEA · Registro de Asistencia
// ============================================================

let grupoActual = null;
let estudiantesActuales = [];
let asistenciaExistente = null;
let ordenActual = 'nombre';

async function initRegistro() {
  const fechaInput = document.getElementById('reg-fecha');
  if (!fechaInput.value) fechaInput.value = todayISO();

  await cargarGruposEnSelect('reg-grupo');

  document.getElementById('btn-cargar-grupo').onclick = cargarGrupo;
  document.getElementById('btn-guardar-asistencia').onclick = guardarAsistencia;
}

// ---- Cargar lista de grupos disponibles ----

async function cargarGruposEnSelect(selectId) {
  const { data } = await db
    .from('estudiantes')
    .select('curso_grupo, tipo_curso')
    .eq('activo', true)
    .order('curso_grupo');

  if (!data?.length) return;

  const grupos = [...new Map(data.map(r => [r.curso_grupo, r])).values()];

  const select = document.getElementById(selectId);
  const prev = select.value;
  const firstOpt = select.options[0];
  select.innerHTML = '';
  select.appendChild(firstOpt);

  grupos.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.curso_grupo;
    opt.textContent = `${g.curso_grupo} · ${g.tipo_curso}`;
    opt.dataset.tipo = g.tipo_curso;
    select.appendChild(opt);
  });

  if (prev) select.value = prev;
}

// ---- Cargar sugerencias de grupos existentes en un <datalist> ----
// Evita que se repita el mismo grupo con distinta capitalización/acentos.

async function cargarGruposEnDatalist(datalistId) {
  const { data } = await db
    .from('estudiantes')
    .select('curso_grupo')
    .order('curso_grupo');

  const datalist = document.getElementById(datalistId);
  if (!datalist) return;

  datalist.innerHTML = '';
  if (!data?.length) return;

  const grupos = [...new Set(data.map(r => r.curso_grupo))];
  grupos.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    datalist.appendChild(opt);
  });
}

// ---- Cargar estudiantes del grupo seleccionado ----

async function cargarGrupo() {
  const fecha = document.getElementById('reg-fecha').value;
  const grupo = document.getElementById('reg-grupo').value;

  if (!fecha || !grupo) {
    toast('Selecciona fecha y grupo antes de continuar.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-cargar-grupo');
  btn.disabled = true;
  btn.textContent = 'Cargando...';

  // Sin filtro de activo: un inactivo con registro en ESTA sesión debe seguir en la
  // planilla, porque guardarAsistencia() reemplaza todo el detalle con lo que haya en
  // pantalla — ocultarlo borraría su historial al volver a guardar.
  const { data: ests, error: estErr } = await db
    .from('estudiantes')
    .select('id, codigo_estudiante, nombre_completo, tipo_curso, created_at, activo')
    .eq('curso_grupo', grupo)
    .order('nombre_completo');

  // Verificar registro existente
  const { data: existing } = await db
    .from('asistencias')
    .select(`*, detalle_asistencias(
      estudiante_id, presente, alerta_precalculo, alerta_psicologia, observacion,
      numero_taller, comunicacion, procedimientos, representacion, razonamiento
    )`)
    .eq('fecha', fecha)
    .eq('curso_grupo', grupo)
    .maybeSingle();

  btn.disabled = false;
  btn.textContent = 'Cargar grupo';

  if (estErr || !ests?.length) {
    toast('No hay estudiantes en este grupo.', 'warning');
    return;
  }

  // La planilla muestra: activos ya matriculados en la fecha de la sesión, más
  // cualquiera (activo o no) que YA tenga registro en ella. Mostrar a un matriculado
  // después de la fecha lo marcaría ausente en una clase anterior a su matrícula.
  const yaRegistrados = new Set(
    (existing?.detalle_asistencias || []).map(d => d.estudiante_id)
  );
  const visibles = ests.filter(e =>
    (e.activo && fechaLocalISO(e.created_at) <= fecha) || yaRegistrados.has(e.id)
  );

  if (!visibles.length) {
    toast('Ningún estudiante del grupo estaba matriculado y activo en esa fecha.', 'warning');
    return;
  }

  // Solo se avisa por los matriculados tarde; los inactivos sin registro se omiten
  // en silencio, igual que siempre.
  const ocultosPorFecha = ests.filter(e =>
    e.activo && fechaLocalISO(e.created_at) > fecha && !yaRegistrados.has(e.id)
  ).length;
  if (ocultosPorFecha > 0) {
    toast(
      `${ocultosPorFecha} estudiante${ocultosPorFecha !== 1 ? 's' : ''} ` +
      `no aparece${ocultosPorFecha !== 1 ? 'n' : ''}: se matriculó después de esta fecha.`,
      'default'
    );
  }

  asistenciaExistente = existing;

  estudiantesActuales = visibles;
  grupoActual = { grupo, fecha, tipo_curso: visibles[0].tipo_curso };
  ordenActual = 'nombre';

  // Reiniciar botones de orden
  document.getElementById('sort-btn-nombre')?.classList.replace('btn-ghost', 'btn-primary');
  document.getElementById('sort-btn-codigo')?.classList.replace('btn-primary', 'btn-ghost');

  const tallerExistente = existing?.detalle_asistencias
    ?.find(d => d.numero_taller !== null && d.numero_taller !== undefined)
    ?.numero_taller;
  if (tallerExistente !== undefined) {
    document.getElementById('reg-num-taller').value = tallerExistente;
  }

  renderStudentList(visibles, existing);
  mostrarFormRegistro(grupo, visibles[0].tipo_curso, existing);
}

function mostrarFormRegistro(grupo, tipoCurso, existing) {
  document.getElementById('registro-form-container').classList.remove('hidden');

  document.getElementById('reg-titulo-grupo').textContent = grupo;
  document.getElementById('reg-tipo-curso-badge').textContent = tipoCurso;
  document.getElementById('reg-tipo-curso-badge').className =
    'badge ' + (tipoCurso === 'Precálculo' ? 'badge-blue' : 'badge-green');

  actualizarContadores();
}

function renderStudentList(estudiantes, existing) {
  const container = document.getElementById('student-list');

  const detalleMap = {};
  if (existing?.detalle_asistencias) {
    existing.detalle_asistencias.forEach(d => { detalleMap[d.estudiante_id] = d; });
  }

  container.innerHTML = estudiantes.map(est => {
    const d = detalleMap[est.id];

    let estadoClass = '';
    if (d) {
      if (d.presente === true)  estadoClass = 'presente';
      if (d.presente === false) estadoClass = 'ausente';
    }

    const isPresenteActive = d?.presente === true;
    const isAusenteActive  = d?.presente === false;

    const preActive = d?.alerta_precalculo ? ' active' : '';
    const psiActive = d?.alerta_psicologia ? ' active' : '';
    const obsValue  = d?.observacion ? escapeHtml(d.observacion) : '';

    const tallerSugerido = document.getElementById('reg-num-taller')?.value || '';
    const tallerValue = (d?.numero_taller !== null && d?.numero_taller !== undefined)
      ? d.numero_taller
      : tallerSugerido;

    const puntaje = (campo) => (d?.[campo] !== null && d?.[campo] !== undefined) ? d[campo] : '';

    const inactivoBadge = est.activo === false
      ? ' <span class="badge badge-gray">Inactivo</span>'
      : '';

    return `
      <div class="student-item ${estadoClass}" data-id="${est.id}">
        <div class="student-header">
          <div class="student-name">${escapeHtml(est.nombre_completo)}${inactivoBadge}</div>
          <div class="student-code">${est.codigo_estudiante}</div>
        </div>
        <div class="student-presence">
          <button class="btn-presence-asistio${isPresenteActive ? ' active' : ''}"
                  onclick="marcarPresencia(this, 'presente')" type="button">
            ✓ Asistió
          </button>
          <button class="btn-presence-ausente${isAusenteActive ? ' active' : ''}"
                  onclick="marcarPresencia(this, 'ausente')" type="button">
            ✕ No asistió
          </button>
        </div>
        <div class="student-extra">
          <div class="student-alert-btns">
            <button class="btn-alerta-est${preActive}" data-tipo="precalculo"
                    onclick="toggleAlertaEst(this)" title="Alerta Didáctica del Cálculo">
              ⚠ Didáctica
            </button>
            <button class="btn-alerta-est${psiActive}" data-tipo="psicologia"
                    onclick="toggleAlertaEst(this)" title="Alerta Psicología">
              ♡ Psicología
            </button>
          </div>
          <div class="student-puntajes">
            <label class="student-puntaje-label">
              Taller
              <input type="number" class="est-taller" min="1" max="99" value="${tallerValue}">
            </label>
            <label class="student-puntaje-label">
              Comunicación
              <input type="number" class="est-comunicacion" min="1" max="5" value="${puntaje('comunicacion')}">
            </label>
            <label class="student-puntaje-label">
              Procedimientos
              <input type="number" class="est-procedimientos" min="1" max="5" value="${puntaje('procedimientos')}">
            </label>
            <label class="student-puntaje-label">
              Representación
              <input type="number" class="est-representacion" min="1" max="5" value="${puntaje('representacion')}">
            </label>
            <label class="student-puntaje-label">
              Razonamiento
              <input type="number" class="est-razonamiento" min="1" max="5" value="${puntaje('razonamiento')}">
            </label>
          </div>
          <label class="est-obs-label">Fortalezas, dificultades y observaciones del estudiante en esta sesión</label>
          <input type="text" class="est-obs"
                 placeholder="Fortalezas, dificultades y observaciones..."
                 value="${obsValue}">
        </div>
      </div>
    `;
  }).join('');
}

// ---- Presencia: dos botones explícitos ----

function marcarPresencia(btn, estado) {
  const item = btn.closest('.student-item');
  const isActive = btn.classList.contains('active');

  // Desactivar ambos botones y quitar estado visual del card
  item.querySelectorAll('.btn-presence-asistio, .btn-presence-ausente').forEach(b => b.classList.remove('active'));
  item.classList.remove('presente', 'ausente');

  if (!isActive) {
    // Activar el botón pulsado
    btn.classList.add('active');
    item.classList.add(estado);
  }

  actualizarContadores();
}

function toggleAlertaEst(btn) {
  btn.classList.toggle('active');
}

function actualizarContadores() {
  const items = document.querySelectorAll('.student-item');
  let presentes = 0;
  items.forEach(it => {
    if (it.classList.contains('presente')) presentes++;
  });
  const total = items.length;
  document.getElementById('count-presentes').textContent = presentes;
  document.getElementById('count-ausentes').textContent  = total - presentes;
}

// ---- Ordenar tarjetas ----

function leerPuntajeInt(item, selector) {
  const raw = item.querySelector(selector)?.value.trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

// Rangos válidos según los CHECK de la BD (detalle_asistencias_*_check)
const PUNTAJE_CAMPOS = [
  { selector: '.est-taller',         nombre: 'Taller',         min: 1, max: 99 },
  { selector: '.est-comunicacion',   nombre: 'Comunicación',   min: 1, max: 5 },
  { selector: '.est-procedimientos', nombre: 'Procedimientos', min: 1, max: 5 },
  { selector: '.est-representacion', nombre: 'Representación', min: 1, max: 5 },
  { selector: '.est-razonamiento',   nombre: 'Razonamiento',   min: 1, max: 5 },
];

function validarPuntajes(items) {
  for (const it of items) {
    for (const campo of PUNTAJE_CAMPOS) {
      const input = it.querySelector(campo.selector);
      const raw = input?.value.trim();
      if (!raw) continue;
      const n = parseInt(raw, 10);
      if (isNaN(n) || n < campo.min || n > campo.max) {
        const nombre = it.querySelector('.student-name')?.textContent || 'un estudiante';
        toast(
          `"${campo.nombre}" de ${nombre} tiene el valor "${raw}". ` +
          `Debe estar entre ${campo.min} y ${campo.max}, o dejarse vacío. No se guardó nada.`,
          'error'
        );
        it.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
        return false;
      }
    }
  }
  return true;
}

function captureCurrentState() {
  const detalle = [];
  document.querySelectorAll('.student-item').forEach(it => {
    detalle.push({
      estudiante_id:     it.dataset.id,
      presente:          it.classList.contains('presente') ? true
                       : it.classList.contains('ausente')  ? false
                       : null,
      alerta_precalculo: it.querySelector('[data-tipo="precalculo"]')?.classList.contains('active') || false,
      alerta_psicologia: it.querySelector('[data-tipo="psicologia"]')?.classList.contains('active') || false,
      observacion:       it.querySelector('.est-obs')?.value.trim() || null,
      numero_taller:     leerPuntajeInt(it, '.est-taller'),
      comunicacion:      leerPuntajeInt(it, '.est-comunicacion'),
      procedimientos:    leerPuntajeInt(it, '.est-procedimientos'),
      representacion:    leerPuntajeInt(it, '.est-representacion'),
      razonamiento:      leerPuntajeInt(it, '.est-razonamiento'),
    });
  });
  return { detalle_asistencias: detalle };
}

function sortEstudiantes(campo) {
  const snapshot = captureCurrentState();
  ordenActual = campo;

  if (campo === 'nombre') {
    estudiantesActuales.sort((a, b) =>
      a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
  } else {
    estudiantesActuales.sort((a, b) =>
      a.codigo_estudiante.localeCompare(b.codigo_estudiante));
  }

  // Actualizar visual de botones de orden
  const btnNombre = document.getElementById('sort-btn-nombre');
  const btnCodigo = document.getElementById('sort-btn-codigo');
  if (btnNombre && btnCodigo) {
    btnNombre.className = `btn btn-sm ${campo === 'nombre' ? 'btn-primary' : 'btn-ghost'}`;
    btnCodigo.className = `btn btn-sm ${campo === 'codigo' ? 'btn-primary' : 'btn-ghost'}`;
  }

  renderStudentList(estudiantesActuales, snapshot);
  actualizarContadores();
}

// ---- Guardar asistencia ----

async function guardarAsistencia() {
  if (!grupoActual) return;

  const items = document.querySelectorAll('.student-item');
  if (!items.length) return;

  // Validar puntajes ANTES de tocar la BD: un valor fuera de rango
  // violaría los CHECK de detalle_asistencias y dejaría la edición a medias.
  if (!validarPuntajes(items)) return;

  // Si nadie está marcado como presente, confirmar antes de guardar todos como ausentes
  const hayPresentes = [...items].some(it => it.classList.contains('presente'));
  if (!hayPresentes) {
    if (!confirm('Ningún estudiante fue marcado como presente.\n¿Guardar a todos como ausentes?')) return;
  }

  let presentes = 0;
  let ausentes  = 0;
  const detalle = [];

  items.forEach(it => {
    const estId  = it.dataset.id;
    const isPres = it.classList.contains('presente');

    if (isPres) presentes++;
    else        ausentes++;

    const alertaPre = it.querySelector('.btn-alerta-est[data-tipo="precalculo"]')
                         ?.classList.contains('active') || false;
    const alertaPsi = it.querySelector('.btn-alerta-est[data-tipo="psicologia"]')
                         ?.classList.contains('active') || false;
    const obs = it.querySelector('.est-obs')?.value.trim() || null;

    detalle.push({
      estudiante_id:     estId,
      presente:          isPres,
      alerta_precalculo: alertaPre,
      alerta_psicologia: alertaPsi,
      observacion:       obs,
      numero_taller:     leerPuntajeInt(it, '.est-taller'),
      comunicacion:      leerPuntajeInt(it, '.est-comunicacion'),
      procedimientos:    leerPuntajeInt(it, '.est-procedimientos'),
      representacion:    leerPuntajeInt(it, '.est-representacion'),
      razonamiento:      leerPuntajeInt(it, '.est-razonamiento'),
    });
  });

  const payload = {
    fecha:          grupoActual.fecha,
    profesor_email: currentUser.email,
    curso_grupo:    grupoActual.grupo,
    tipo_curso:     grupoActual.tipo_curso,
    presentes,
    ausentes,
  };

  const btn = document.getElementById('btn-guardar-asistencia');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  let asistenciaId;

  if (asistenciaExistente) {
    const { data, error } = await db
      .from('asistencias')
      .update({ ...payload, timestamp: new Date().toISOString() })
      .eq('id', asistenciaExistente.id)
      .select('id')
      .single();

    if (error) {
      toast('Error al actualizar: ' + error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Guardar Asistencia';
      return;
    }

    asistenciaId = data.id;
    await db.from('detalle_asistencias').delete().eq('asistencia_id', asistenciaId);
  } else {
    const { data, error } = await db
      .from('asistencias')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      toast('Error al guardar: ' + error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Guardar Asistencia';
      return;
    }

    asistenciaId = data.id;
  }

  const detallePayload = detalle.map(d => ({
    asistencia_id:     asistenciaId,
    estudiante_id:     d.estudiante_id,
    presente:          d.presente,
    alerta_precalculo: d.alerta_precalculo,
    alerta_psicologia: d.alerta_psicologia,
    observacion:       d.observacion,
    numero_taller:     d.numero_taller,
    comunicacion:      d.comunicacion,
    procedimientos:    d.procedimientos,
    representacion:    d.representacion,
    razonamiento:      d.razonamiento,
  }));

  const obsGuardadas = detallePayload.filter(d => d.observacion).length;
  console.log('[SEA] Guardando detalle:', detallePayload.length, 'filas,', obsGuardadas, 'con observación', detallePayload.filter(d=>d.observacion).map(d=>d.observacion));

  const { error: detErr } = await db.from('detalle_asistencias').insert(detallePayload);
  if (detErr) {
    console.error('[SEA] Error insertando detalle:', detErr.message);

    // El detalle previo ya fue borrado (flujo de edición): intentar restaurarlo
    // para que un fallo en el insert no deje la sesión sin detalle.
    if (asistenciaExistente?.detalle_asistencias?.length) {
      const restore = asistenciaExistente.detalle_asistencias.map(d => ({
        asistencia_id: asistenciaId,
        ...d,
      }));
      const { error: restErr } = await db.from('detalle_asistencias').insert(restore);
      if (restErr) {
        console.error('[SEA] No se pudo restaurar el detalle previo:', restErr.message);
      } else {
        console.warn('[SEA] Detalle previo restaurado tras fallo del guardado.');
      }
    }

    toast('Error al guardar el detalle: ' + detErr.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Guardar Asistencia';
    return;
  }

  btn.disabled = false;
  btn.textContent = 'Guardar Asistencia';

  toast('Asistencia registrada correctamente. Puedes verificar los cambios en Historial.', 'success');

  await cargarGrupo();
  await loadAlertBadge();
}
