// ============================================================
//  SEA · Panel de Alertas (por estudiante · detalle_asistencias)
// ============================================================

async function loadAlertas() {
  await Promise.all([
    cargarAlertasPrecalculo(),
    cargarAlertasPsicologia(),
  ]);
}

async function cargarAlertasPrecalculo() {
  const container = document.getElementById('alertas-precalculo-container');
  container.innerHTML = '<div class="empty-state">Cargando...</div>';

  const { data, error } = await db
    .from('detalle_asistencias')
    .select(`
      alerta_precalculo, alerta_psicologia, observacion,
      asistencias!inner(fecha, curso_grupo, tipo_curso),
      estudiantes!inner(nombre_completo, codigo_estudiante)
    `)
    .eq('alerta_precalculo', true)
    .limit(50);

  if (data) data.sort((a, b) =>
    (b.asistencias?.fecha || '').localeCompare(a.asistencias?.fecha || ''));

  const count = data?.length ?? 0;
  document.getElementById('tab-count-precalculo').textContent = count;

  if (error) {
    container.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
    return;
  }

  if (!count) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✓</div>
        Sin alertas de Didáctica del Cálculo activas.
      </div>`;
    return;
  }

  container.innerHTML = data.map(r => `
    <div class="alert-card">
      <div class="alert-card-icon red">⚠</div>
      <div class="alert-card-info">
        <div class="alert-card-title">${escapeHtml(r.estudiantes.nombre_completo)}</div>
        <div class="alert-card-sub">
          ${r.asistencias.curso_grupo} · ${r.asistencias.tipo_curso}
        </div>
        ${r.observacion
          ? `<div class="alert-card-obs">"${escapeHtml(r.observacion)}"</div>`
          : ''}
      </div>
      <div class="alert-card-date">${formatDate(r.asistencias.fecha)}</div>
    </div>
  `).join('');
}

async function cargarAlertasPsicologia() {
  const container = document.getElementById('alertas-psicologia-container');
  container.innerHTML = '<div class="empty-state">Cargando...</div>';

  const { data, error } = await db
    .from('detalle_asistencias')
    .select(`
      alerta_precalculo, alerta_psicologia, observacion,
      asistencias!inner(fecha, curso_grupo, tipo_curso),
      estudiantes!inner(nombre_completo, codigo_estudiante)
    `)
    .eq('alerta_psicologia', true)
    .limit(50);

  if (data) data.sort((a, b) =>
    (b.asistencias?.fecha || '').localeCompare(a.asistencias?.fecha || ''));

  const count = data?.length ?? 0;
  document.getElementById('tab-count-psicologia').textContent = count;

  if (error) {
    container.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
    return;
  }

  if (!count) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">♡</div>
        Sin alertas de Psicología activas.
      </div>`;
    return;
  }

  container.innerHTML = data.map(r => `
    <div class="alert-card">
      <div class="alert-card-icon amber">♡</div>
      <div class="alert-card-info">
        <div class="alert-card-title">${escapeHtml(r.estudiantes.nombre_completo)}</div>
        <div class="alert-card-sub">
          ${r.asistencias.curso_grupo} · ${r.asistencias.tipo_curso}
        </div>
        ${r.observacion
          ? `<div class="alert-card-obs">"${escapeHtml(r.observacion)}"</div>`
          : ''}
      </div>
      <div class="alert-card-date">${formatDate(r.asistencias.fecha)}</div>
    </div>
  `).join('');
}
