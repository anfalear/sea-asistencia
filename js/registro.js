// ============================================================
//  SEA · Registro de Asistencia
// ============================================================

let grupoActual = null;      // datos del grupo cargado
let estudiantesActuales = []; // lista de estudiantes del grupo
let asistenciaExistente = null; // registro ya guardado (para edición)

async function initRegistro() {
  // Establecer fecha de hoy
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

  // Grupos únicos
  const grupos = [...new Map(data.map(r => [r.curso_grupo, r])).values()];

  const select = document.getElementById(selectId);
  const prev = select.value;
  // Preservar la opción vacía
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
  const fecha  = document.getElementById('reg-fecha').value;
  const grupo  = document.getElementById('reg-grupo').value;

  if (!fecha || !grupo) {
    toast('Selecciona fecha y grupo antes de continuar.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-cargar-grupo');
  btn.disabled = true;
  btn.textContent = 'Cargando...';

  // Obtener estudiantes del grupo
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
  grupoActual = {
    grupo,
    fecha,
    tipo_curso: ests[0].tipo_curso,
  };

  // Verificar si ya existe asistencia para ese día/grupo
  const { data: existing } = await db
    .from('asistencias')
    .select('*, detalle_asistencias(estudiante_id, presente)')
    .eq('fecha', fecha)
    .eq('curso_grupo', grupo)
    .maybeSingle();

  asistenciaExistente = existing;

  renderStudentList(ests, existing);
  mostrarFormRegistro(grupo, ests[0].tipo_curso, existing);
}

function mostrarFormRegistro(grupo, tipoCurso, existing) {
  const container = document.getElementById('registro-form-container');
  container.classList.remove('hidden');

  document.getElementById('reg-titulo-grupo').textContent = grupo;
  document.getElementById('reg-tipo-curso-badge').textContent = tipoCurso;
  document.getElementById('reg-tipo-curso-badge').className =
    'badge ' + (tipoCurso === 'Precálculo' ? 'badge-blue' : 'badge-green');

  // Cargar datos existentes si hay registro previo
  if (existing) {
    document.getElementById('check-alerta-precalculo').checked = existing.alerta_precalculo;
    document.getElementById('check-alerta-psicologia').checked = existing.alerta_psicologia;
    document.getElementById('reg-observaciones').value = existing.observaciones || '';
    toast('Ya hay asistencia registrada para este día. Puedes editarla.', 'warning', 4000);
  } else {
    document.getElementById('check-alerta-precalculo').checked = false;
    document.getElementById('check-alerta-psicologia').checked = false;
    document.getElementById('reg-observaciones').value = '';
  }

  actualizarContadores();
}

function renderStudentList(estudiantes, existing) {
  const container = document.getElementById('student-list');

  // Mapa de presencia del registro existente
  const presenciaMap = {};
  if (existing?.detalle_asistencias) {
    existing.detalle_asistencias.forEach(d => {
      presenciaMap[d.estudiante_id] = d.presente;
    });
  }

  container.innerHTML = estudiantes.map(est => {
    let estadoClass = '';
    let icon = '·';

    if (existing) {
      const presente = presenciaMap[est.id];
      if (presente === true)  { estadoClass = 'presente'; icon = '✓'; }
      if (presente === false) { estadoClass = 'ausente';  icon = '✕'; }
    }

    return `
      <div class="student-item ${estadoClass}"
           data-id="${est.id}"
           onclick="togglePresencia(this)">
        <div class="student-info">
          <div class="student-name">${est.nombre_completo}</div>
          <div class="student-code">${est.codigo_estudiante}</div>
        </div>
        <div class="student-toggle">${icon}</div>
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

function actualizarContadores() {
  const items = document.querySelectorAll('.student-item');
  let presentes = 0;
  let ausentes = 0;
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

  const items    = document.querySelectorAll('.student-item');
  let presentes  = 0;
  let ausentes   = 0;
  const detalle  = [];

  items.forEach(it => {
    const estId  = it.dataset.id;
    const isPres = it.classList.contains('presente');
    const isAus  = it.classList.contains('ausente');
    if (isPres) { presentes++; detalle.push({ estudiante_id: estId, presente: true  }); }
    if (isAus)  { ausentes++;  detalle.push({ estudiante_id: estId, presente: false }); }
  });

  if (detalle.length === 0) {
    toast('Marca al menos un estudiante antes de guardar.', 'warning');
    return;
  }

  const payload = {
    fecha:             grupoActual.fecha,
    profesor_email:    currentUser.email,
    curso_grupo:       grupoActual.grupo,
    tipo_curso:        grupoActual.tipo_curso,
    presentes,
    ausentes,
    alerta_precalculo: document.getElementById('check-alerta-precalculo').checked,
    alerta_psicologia: document.getElementById('check-alerta-psicologia').checked,
    observaciones:     document.getElementById('reg-observaciones').value.trim() || null,
  };

  const btn = document.getElementById('btn-guardar-asistencia');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  let asistenciaId;

  if (asistenciaExistente) {
    // Actualizar registro existente
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

    // Eliminar detalle anterior y reinsertar
    await db.from('detalle_asistencias').delete().eq('asistencia_id', asistenciaId);
  } else {
    // Insertar nuevo registro
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

  // Insertar detalle de asistencia
  if (detalle.length > 0) {
    const detallePayload = detalle.map(d => ({
      asistencia_id: asistenciaId,
      estudiante_id: d.estudiante_id,
      presente:      d.presente,
    }));

    const { error: detErr } = await db.from('detalle_asistencias').insert(detallePayload);
    if (detErr) console.warn('Error en detalle:', detErr.message);
  }

  btn.disabled = false;
  btn.textContent = 'Guardar Asistencia';

  toast(`Asistencia guardada: ${presentes} presentes, ${ausentes} ausentes.`, 'success');

  // Recargar para mostrar estado actualizado
  await cargarGrupo();
  await loadAlertBadge();
}
