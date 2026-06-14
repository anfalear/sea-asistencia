// ============================================================
//  SEA · Registro de Asistencia
// ============================================================

let grupoActual = null;
let estudiantesActuales = [];
let asistenciaExistente = null;

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

  const { data: ests, error: estErr } = await db
    .from('estudiantes')
    .select('id, codigo_estudiante, nombre_completo, tipo_curso')
    .eq('curso_grupo', grupo)
    .eq('activo', true)
    .order('nombre_completo');

  btn.disabled = false;
  btn.textContent = 'Cargar grupo';

  if (estErr || !ests?.length) {
    toast('No hay estudiantes activos en este grupo.', 'warning');
    return;
  }

  estudiantesActuales = ests;
  grupoActual = { grupo, fecha, tipo_curso: ests[0].tipo_curso };

  // Verificar registro existente e incluir columnas de alerta por estudiante
  const { data: existing } = await db
    .from('asistencias')
    .select('*, detalle_asistencias(estudiante_id, presente, alerta_precalculo, alerta_psicologia, observacion)')
    .eq('fecha', fecha)
    .eq('curso_grupo', grupo)
    .maybeSingle();

  asistenciaExistente = existing;

  renderStudentList(ests, existing);
  mostrarFormRegistro(grupo, ests[0].tipo_curso, existing);
}

function mostrarFormRegistro(grupo, tipoCurso, existing) {
  document.getElementById('registro-form-container').classList.remove('hidden');

  document.getElementById('reg-titulo-grupo').textContent = grupo;
  document.getElementById('reg-tipo-curso-badge').textContent = tipoCurso;
  document.getElementById('reg-tipo-curso-badge').className =
    'badge ' + (tipoCurso === 'Didáctica del Cálculo' ? 'badge-blue' : 'badge-green');

  if (existing) {
    toast('Ya hay asistencia registrada para este día. Puedes editarla.', 'warning', 4000);
  }

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
    let icon = '·';

    if (d) {
      if (d.presente === true)  { estadoClass = 'presente'; icon = '✓'; }
      if (d.presente === false) { estadoClass = 'ausente';  icon = '✕'; }
    }

    const preActive  = d?.alerta_precalculo ? ' active' : '';
    const psiActive  = d?.alerta_psicologia ? ' active' : '';
    const obsValue   = d?.observacion ? escapeHtml(d.observacion) : '';
    const obsDisplay = (d?.alerta_precalculo || d?.alerta_psicologia) ? 'block' : 'none';

    return `
      <div class="student-item ${estadoClass}" data-id="${est.id}">
        <div class="student-row" onclick="togglePresencia(this.closest('.student-item'))">
          <div class="student-info">
            <div class="student-name">${escapeHtml(est.nombre_completo)}</div>
            <div class="student-code">${est.codigo_estudiante}</div>
          </div>
          <div class="student-toggle">${icon}</div>
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
          <input type="text" class="est-obs"
                 placeholder="Observación del estudiante..."
                 value="${obsValue}"
                 style="display:${obsDisplay}">
        </div>
      </div>
    `;
  }).join('');
}

function togglePresencia(el) {
  if (el.classList.contains('presente')) {
    el.classList.remove('presente');
    el.classList.add('ausente');
    el.querySelector('.student-toggle').textContent = '✕';
  } else if (el.classList.contains('ausente')) {
    el.classList.remove('ausente');
    el.querySelector('.student-toggle').textContent = '·';
  } else {
    el.classList.add('presente');
    el.querySelector('.student-toggle').textContent = '✓';
  }
  actualizarContadores();
}

function toggleAlertaEst(btn) {
  btn.classList.toggle('active');
  const extra = btn.closest('.student-extra');
  const tieneAlerta = extra.querySelectorAll('.btn-alerta-est.active').length > 0;
  const obsInput = extra.querySelector('.est-obs');
  obsInput.style.display = tieneAlerta ? 'block' : 'none';
  if (!tieneAlerta) obsInput.value = '';
}

function actualizarContadores() {
  const items = document.querySelectorAll('.student-item');
  let presentes = 0;
  let ausentes  = 0;
  items.forEach(it => {
    if (it.classList.contains('presente')) presentes++;
    if (it.classList.contains('ausente'))  ausentes++;
  });
  document.getElementById('count-presentes').textContent = presentes;
  document.getElementById('count-ausentes').textContent  = ausentes;
}

// ---- Guardar asistencia ----

async function guardarAsistencia() {
  if (!grupoActual) return;

  const items   = document.querySelectorAll('.student-item');
  let presentes = 0;
  let ausentes  = 0;
  const detalle = [];

  items.forEach(it => {
    const estId  = it.dataset.id;
    const isPres = it.classList.contains('presente');
    const isAus  = it.classList.contains('ausente');

    if (isPres || isAus) {
      if (isPres) presentes++;
      if (isAus)  ausentes++;

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
      });
    }
  });

  if (detalle.length === 0) {
    toast('Marca al menos un estudiante antes de guardar.', 'warning');
    return;
  }

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

  if (detalle.length > 0) {
    const detallePayload = detalle.map(d => ({
      asistencia_id:     asistenciaId,
      estudiante_id:     d.estudiante_id,
      presente:          d.presente,
      alerta_precalculo: d.alerta_precalculo,
      alerta_psicologia: d.alerta_psicologia,
      observacion:       d.observacion,
    }));

    const { error: detErr } = await db.from('detalle_asistencias').insert(detallePayload);
    if (detErr) console.warn('Error en detalle:', detErr.message);
  }

  btn.disabled = false;
  btn.textContent = 'Guardar Asistencia';

  toast(`Asistencia guardada: ${presentes} presentes, ${ausentes} ausentes.`, 'success');

  await cargarGrupo();
  await loadAlertBadge();
}
