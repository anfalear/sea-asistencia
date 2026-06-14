// ============================================================
//  SEA · Exportar asistencias a Excel (.xlsx)
// ============================================================

async function exportarAsistencias() {
  const fechaIni = document.getElementById('hist-fecha-ini').value;
  const fechaFin = document.getElementById('hist-fecha-fin').value;
  const grupo    = document.getElementById('hist-grupo').value;

  if (!fechaIni || !fechaFin) {
    toast('Selecciona un rango de fechas antes de exportar.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-exportar-excel');
  btn.disabled = true;
  btn.textContent = 'Exportando...';

  let query = db
    .from('asistencias')
    .select(`
      fecha, curso_grupo, tipo_curso, presentes, ausentes,
      alerta_precalculo, alerta_psicologia, observaciones, profesor_email,
      detalle_asistencias(presente, estudiantes(codigo_estudiante, nombre_completo))
    `)
    .gte('fecha', fechaIni)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: true })
    .order('curso_grupo');

  if (grupo) query = query.eq('curso_grupo', grupo);

  const { data, error } = await query;

  btn.disabled = false;
  btn.textContent = '↓ Descargar Excel';

  if (error) {
    toast('Error al obtener datos: ' + error.message, 'error');
    return;
  }

  if (!data?.length) {
    toast('Sin datos para exportar en el período seleccionado.', 'warning');
    return;
  }

  const rows = [];
  data.forEach(sesion => {
    const detalles = sesion.detalle_asistencias || [];
    if (detalles.length) {
      detalles.forEach(d => {
        rows.push({
          'Fecha':               sesion.fecha,
          'Grupo':               sesion.curso_grupo,
          'Tipo Curso':          sesion.tipo_curso,
          'Profesor':            sesion.profesor_email,
          'Cód. Estudiante':     d.estudiantes?.codigo_estudiante || '',
          'Nombre Estudiante':   d.estudiantes?.nombre_completo   || '',
          'Asistencia':          d.presente ? 'Presente' : 'Ausente',
          'Alerta Didáctica':    sesion.alerta_precalculo  ? 'Sí' : 'No',
          'Alerta Psicología':   sesion.alerta_psicologia  ? 'Sí' : 'No',
          'Observaciones':       sesion.observaciones || '',
        });
      });
    } else {
      rows.push({
        'Fecha':             sesion.fecha,
        'Grupo':             sesion.curso_grupo,
        'Tipo Curso':        sesion.tipo_curso,
        'Profesor':          sesion.profesor_email,
        'Cód. Estudiante':   '',
        'Nombre Estudiante': '',
        'Asistencia':        '',
        'Alerta Didáctica':  sesion.alerta_precalculo ? 'Sí' : 'No',
        'Alerta Psicología': sesion.alerta_psicologia ? 'Sí' : 'No',
        'Observaciones':     sesion.observaciones || '',
      });
    }
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Anchos de columna aproximados
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 28 },
    { wch: 14 }, { wch: 32 }, { wch: 10 },
    { wch: 18 }, { wch: 18 }, { wch: 36 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Asistencias');

  const filename = `asistencias_${fechaIni}_${fechaFin}.xlsx`;
  XLSX.writeFile(wb, filename);

  toast(`Archivo descargado: ${filename}`, 'success');
}
