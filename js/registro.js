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
  ordenActual = 'nombre';

  // Reiniciar botones de orden
  document.getElementById('sort-btn-nombre')?.classList.replace('btn-ghost', 'btn-primary');
  document.getElementById('sort-btn-codigo')?.classList.replace('btn-primary', 'btn-ghost');

  // Verificar registro existente
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

    return `
      <div class="student-item ${estadoClass}" data-id="${est.id}">
        <div class="student-header">
          <div class="student-name">${escapeHtml(est.nombre_completo)}</div>
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
          <input type="text" class="est-obs"
                 placeholder="Observación del estudiante..."
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
  }));

  const obsGuardadas = detallePayload.filter(d => d.observacion).length;
  console.log('[SEA] Guardando detalle:', detallePayload.length, 'filas,', obsGuardadas, 'con observación', detallePayload.filter(d=>d.observacion).map(d=>d.observacion));

  const { error: detErr } = await db.from('detalle_asistencias').insert(detallePayload);
  if (detErr) {
    console.error('[SEA] Error insertando detalle:', detErr.message);
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
