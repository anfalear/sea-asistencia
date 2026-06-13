// ============================================================
//  SEA · Historial de asistencias
// ============================================================

async function initHistorial() {
  // Fechas por defecto: este mes
  const hoy = todayISO();
  const primerDiaMes = hoy.substring(0, 8) + '01';

  const fIni = document.getElementById('hist-fecha-ini');
  const fFin = document.getElementById('hist-fecha-fin');

  if (!fIni.value) fIni.value = primerDiaMes;
  if (!fFin.value) fFin.value = hoy;

  await cargarGruposEnSelect('hist-grupo');

  document.getElementById('btn-filtrar-historial').onclick = cargarHistorial;
}

async function cargarHistorial() {
  const fechaIni = document.getElementById('hist-fecha-ini').value;
  const fechaFin = document.getElementById('hist-fecha-fin').value;
  const grupo    = document.getElementById('hist-grupo').value;

  if (!fechaIni || !fechaFin) {
    toast('Selecciona un rango de fechas.', 'warning');
    return;
  }

  const container = document.getElementById('historial-table-container');
  container.innerHTML = '<div class="empty-state">Cargando...</div>';

  let query = db
    .from('asistencias')
    .select('*')
    .gte('fecha', fechaIni)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: false })
    .order('curso_grupo');

  if (grupo) query = query.eq('curso_grupo', grupo);

  const { data, error } = await query;

  if (error) {
    container.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
    return;
  }

  if (!data?.length) {
    container.innerHTML = '<div class="empty-state">Sin registros en el período seleccionado.</div>';
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Grupo</th>
            <th>Tipo</th>
            <th>Presentes</th>
            <th>Ausentes</th>
            <th>Alertas</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r => `
            <tr>
              <td><strong>${formatDate(r.fecha)}</strong></td>
              <td>${r.curso_grupo}</td>
              <td>
                <span class="badge ${r.tipo_curso === 'Precálculo' ? 'badge-blue' : 'badge-green'}">
                  ${r.tipo_curso}
                </span>
              </td>
              <td>
                <span class="badge badge-green">${r.presentes}</span>
              </td>
              <td>
                <span class="badge ${r.ausentes > 0 ? 'badge-red' : 'badge-gray'}">${r.ausentes}</span>
              </td>
              <td>
                <div class="hist-row-alerts">${alertBadges(r)}</div>
              </td>
              <td style="max-width:220px;white-space:normal;font-size:12.5px;color:var(--text-muted)">
                ${r.observaciones || '—'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="padding:12px 16px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border)">
      ${data.length} registro${data.length !== 1 ? 's' : ''} encontrado${data.length !== 1 ? 's' : ''}
    </div>
  `;
}
