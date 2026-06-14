// ============================================================
//  SEA · Estadísticas de asistencia por estudiante
// ============================================================

async function mostrarEstadisticasEstudiante(estudianteId, nombreEstudiante) {
  const modal = document.getElementById('modal-estadisticas');
  document.getElementById('modal-est-titulo').textContent = nombreEstudiante;
  document.getElementById('modal-est-loading').classList.remove('hidden');
  document.getElementById('modal-est-content').classList.add('hidden');
  modal.classList.remove('hidden');

  const { data, error } = await db
    .from('detalle_asistencias')
    .select('presente, asistencias(fecha)')
    .eq('estudiante_id', estudianteId);

  document.getElementById('modal-est-loading').classList.add('hidden');

  if (error || !data?.length) {
    document.getElementById('modal-est-content').innerHTML =
      '<div class="empty-state">Sin registros de asistencia para este estudiante.</div>';
    document.getElementById('modal-est-content').classList.remove('hidden');
    return;
  }

  const total      = data.length;
  const asistio    = data.filter(d => d.presente).length;
  const ausencias  = total - asistio;
  const porcentaje = total > 0 ? Math.round((asistio / total) * 100) : 0;

  document.getElementById('est-stat-total').textContent   = total;
  document.getElementById('est-stat-asistio').textContent = asistio;
  document.getElementById('est-stat-ausente').textContent = ausencias;
  document.getElementById('est-stat-pct').textContent     = porcentaje + '%';

  document.getElementById('modal-est-content').classList.remove('hidden');

  if (window._chartAsistencia) {
    window._chartAsistencia.destroy();
    window._chartAsistencia = null;
  }

  const canvas = document.getElementById('chart-asistencia');
  window._chartAsistencia = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Asistió', 'Ausente'],
      datasets: [{
        data: [asistio, ausencias],
        backgroundColor: ['#16a34a', '#dc2626'],
        borderWidth: 3,
        borderColor: '#ffffff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = Math.round((ctx.parsed / total) * 100);
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function cerrarModalEstadisticas() {
  document.getElementById('modal-estadisticas').classList.add('hidden');
  if (window._chartAsistencia) {
    window._chartAsistencia.destroy();
    window._chartAsistencia = null;
  }
}
