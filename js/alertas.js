// ============================================================
//  SEA · Panel de Alertas
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
    .from('asistencias')
    .select('*')
    .eq('alerta_precalculo', true)
    .order('fecha', { ascending: false })
    .limit(50);

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
        Sin alertas de Precálculo activas.
      </div>`;
    return;
  }

  container.innerHTML = data.map(r => `
    <div class="alert-card">
      <div class="alert-card-icon red">⚠</div>
      <div class="alert-card-info">
        <div class="alert-card-title">${r.curso_grupo}</div>
        <div class="alert-card-sub">
          ${r.tipo_curso} · Profesor: ${r.profesor_email}
        </div>
        <div class="alert-card-sub" style="margin-top:4px">
          Presentes: <strong>${r.presentes}</strong> · Ausentes: <strong>${r.ausentes}</strong>
        </div>
        ${r.observaciones ? `<div class="alert-card-obs">"${r.observaciones}"</div>` : ''}
      </div>
      <div class="alert-card-date">${formatDate(r.fecha)}</div>
    </div>
  `).join('');
}

async function cargarAlertasPsicologia() {
  const container = document.getElementById('alertas-psicologia-container');
  container.innerHTML = '<div class="empty-state">Cargando...</div>';

  const { data, error } = await db
    .from('asistencias')
    .select('*')
    .eq('alerta_psicologia', true)
    .order('fecha', { ascending: false })
    .limit(50);

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
        <div class="alert-card-title">${r.curso_grupo}</div>
        <div class="alert-card-sub">
          ${r.tipo_curso} · Profesor: ${r.profesor_email}
        </div>
        <div class="alert-card-sub" style="margin-top:4px">
          Presentes: <strong>${r.presentes}</strong> · Ausentes: <strong>${r.ausentes}</strong>
        </div>
        ${r.observaciones ? `<div class="alert-card-obs">"${r.observaciones}"</div>` : ''}
      </div>
      <div class="alert-card-date">${formatDate(r.fecha)}</div>
    </div>
  `).join('');
}
