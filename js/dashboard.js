// ============================================================
//  SEA · Dashboard
// ============================================================

async function loadDashboard() {
  await Promise.all([
    loadDashboardStats(),
    loadRecentActivity(),
    loadDashboardAlerts(),
    loadAlertBadge(),
  ]);
}

async function loadDashboardStats() {
  const today = todayISO();
  const weekStart = getWeekStart();

  // Total estudiantes activos
  const { count: totalEst } = await db
    .from('estudiantes')
    .select('*', { count: 'exact', head: true })
    .eq('activo', true);

  // Sesiones hoy
  const { count: sesionesHoy } = await db
    .from('asistencias')
    .select('*', { count: 'exact', head: true })
    .eq('fecha', today);

  // Alertas activas por estudiante (últimos 30 días)
  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);
  const { count: alertasActivas } = await db
    .from('detalle_asistencias')
    .select('asistencia_id, asistencias!inner(fecha)', { count: 'exact', head: true })
    .or('alerta_precalculo.eq.true,alerta_psicologia.eq.true')
    .gte('asistencias.fecha', hace30.toISOString().split('T')[0]);

  // Sesiones esta semana
  const { count: sesionesSemana } = await db
    .from('asistencias')
    .select('*', { count: 'exact', head: true })
    .gte('fecha', weekStart);

  document.getElementById('stat-total-estudiantes').textContent = totalEst ?? '—';
  document.getElementById('stat-sesiones-hoy').textContent      = sesionesHoy ?? '0';
  document.getElementById('stat-alertas-activas').textContent   = alertasActivas ?? '0';
  document.getElementById('stat-sesiones-semana').textContent   = sesionesSemana ?? '0';
}

async function loadRecentActivity() {
  const el = document.getElementById('dashboard-recent');
  const { data, error } = await db
    .from('asistencias')
    .select('fecha, curso_grupo, tipo_curso, presentes, ausentes')
    .order('timestamp', { ascending: false })
    .limit(8);

  if (error || !data?.length) {
    el.innerHTML = '<div class="empty-state">Sin actividad reciente.</div>';
    return;
  }

  el.innerHTML = data.map(r => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div class="activity-text">
        <strong>${r.curso_grupo}</strong> · ${r.tipo_curso}<br>
        <span style="color:var(--text-muted);font-size:12px">
          ${formatDate(r.fecha)} · ${r.presentes} presentes, ${r.ausentes} ausentes
        </span>
      </div>
    </div>
  `).join('');
}

async function loadDashboardAlerts() {
  const el = document.getElementById('dashboard-alerts');
  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);
  const fechaLimite = hace30.toISOString().split('T')[0];

  const { data, error } = await db
    .from('detalle_asistencias')
    .select(`
      alerta_precalculo, alerta_psicologia, observacion,
      asistencias!inner(fecha, curso_grupo),
      estudiantes!inner(nombre_completo)
    `)
    .or('alerta_precalculo.eq.true,alerta_psicologia.eq.true')
    .gte('asistencias.fecha', fechaLimite)
    .limit(6);

  if (error || !data?.length) {
    el.innerHTML = '<div class="empty-state">Sin alertas activas. ✓</div>';
    return;
  }

  data.sort((a, b) =>
    (b.asistencias?.fecha || '').localeCompare(a.asistencias?.fecha || ''));

  el.innerHTML = data.map(r => {
    const badges = [
      r.alerta_precalculo ? '<span class="badge badge-red">Didáctica</span>' : '',
      r.alerta_psicologia ? '<span class="badge badge-amber">Psicología</span>' : '',
    ].filter(Boolean).join(' ');

    return `
      <div class="activity-item">
        <div class="activity-dot" style="background:var(--red)"></div>
        <div class="activity-text">
          <strong>${escapeHtml(r.estudiantes.nombre_completo)}</strong><br>
          <span style="color:var(--text-muted);font-size:12px">
            ${r.asistencias.curso_grupo} · ${formatDate(r.asistencias.fecha)}
          </span>
          <div style="margin-top:4px">${badges}</div>
          ${r.observacion
            ? `<div style="font-size:12px;color:var(--text-muted);font-style:italic;margin-top:2px">
                "${escapeHtml(r.observacion)}"
               </div>`
            : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function loadAlertBadge() {
  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);
  const fechaLimite = hace30.toISOString().split('T')[0];

  const { count } = await db
    .from('detalle_asistencias')
    .select('asistencia_id, asistencias!inner(fecha)', { count: 'exact', head: true })
    .or('alerta_precalculo.eq.true,alerta_psicologia.eq.true')
    .gte('asistencias.fecha', fechaLimite);

  const badge = document.getElementById('badge-alertas');
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0=dom
  const diff = day === 0 ? 6 : day - 1; // lunes
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().split('T')[0];
}
