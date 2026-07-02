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
      fecha, curso_grupo, tipo_curso, presentes, ausentes, profesor_email,
      detalle_asistencias(
        presente, alerta_precalculo, alerta_psicologia, observacion,
        numero_taller, comunicacion, procedimientos, representacion, razonamiento,
        estudiantes(codigo_estudiante, nombre_completo, email, direccion_electron, telefono_reside)
      )
    `)
    .gte('fecha', fechaIni)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: true })
    .order('curso_grupo');

  if (grupo) query = query.eq('curso_grupo', grupo);

  const { data, error } = await query;

  let informesQuery = db
    .from('informes_estudiante')
    .select(`periodo, desempeno_general, estudiantes${grupo ? '!inner' : ''}(codigo_estudiante, nombre_completo, curso_grupo)`);

  if (grupo) informesQuery = informesQuery.eq('estudiantes.curso_grupo', grupo);

  const { data: informesData, error: informesError } = await informesQuery;

  btn.disabled = false;
  btn.textContent = '↓ Descargar Excel';

  if (error) {
    toast('Error al obtener datos: ' + error.message, 'error');
    return;
  }
  if (informesError) {
    toast('Error al obtener informes: ' + informesError.message, 'error');
    return;
  }

  if (!data?.length) {
    toast('Sin datos para exportar en el período seleccionado.', 'warning');
    return;
  }

  const filasAsistencia = [];
  const filasPuntajes   = [];
  const filasBitacora   = [];

  data.forEach(sesion => {
    const detalles = sesion.detalle_asistencias || [];
    if (detalles.length) {
      detalles.forEach(d => {
        const nombreEst = d.estudiantes?.nombre_completo || '';

        filasAsistencia.push({
          'Fecha':             sesion.fecha,
          'Grupo':             sesion.curso_grupo,
          'Tipo Curso':        sesion.tipo_curso,
          'Profesor':          sesion.profesor_email,
          'Cód. Estudiante':   d.estudiantes?.codigo_estudiante  || '',
          'Nombre Estudiante': nombreEst,
          'Email':             d.estudiantes?.email              || '',
          'Dir. Electrónica':  d.estudiantes?.direccion_electron || '',
          'Teléfono':          d.estudiantes?.telefono_reside    || '',
          'Asistencia':        d.presente ? 'Presente' : 'Ausente',
          'Alerta Didáctica':  d.alerta_precalculo ? 'Sí' : 'No',
          'Alerta Psicología': d.alerta_psicologia ? 'Sí' : 'No',
          'Observación':       d.observacion || '',
        });

        filasPuntajes.push({
          'Estudiante':      nombreEst,
          'Fecha':           sesion.fecha,
          'Nº Taller':       d.numero_taller  ?? '',
          'Comunicación':    d.comunicacion   ?? '',
          'Procedimientos':  d.procedimientos ?? '',
          'Representación':  d.representacion ?? '',
          'Razonamiento':    d.razonamiento   ?? '',
        });

        filasBitacora.push({
          'Estudiante': nombreEst,
          'Fecha':      sesion.fecha,
          'Nº Taller':  d.numero_taller ?? '',
          'Observación': d.observacion || '',
        });
      });
    } else {
      filasAsistencia.push({
        'Fecha':             sesion.fecha,
        'Grupo':             sesion.curso_grupo,
        'Tipo Curso':        sesion.tipo_curso,
        'Profesor':          sesion.profesor_email,
        'Cód. Estudiante':   '',
        'Nombre Estudiante': '',
        'Asistencia':        '',
        'Alerta Didáctica':  '',
        'Alerta Psicología': '',
        'Observación':       '',
      });
    }
  });

  const filasInformes = (informesData || []).map(inf => ({
    'Estudiante':        inf.estudiantes?.nombre_completo || '',
    'Cód. Estudiante':   inf.estudiantes?.codigo_estudiante || '',
    'Periodo':           inf.periodo,
    'Desempeño General': inf.desempeno_general || '',
  }));

  const wsAsistencia = XLSX.utils.json_to_sheet(filasAsistencia);
  wsAsistencia['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 28 },
    { wch: 14 }, { wch: 32 }, { wch: 30 }, { wch: 30 }, { wch: 16 },
    { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 36 },
  ];

  const wsPuntajes = XLSX.utils.json_to_sheet(filasPuntajes);
  wsPuntajes['!cols'] = [
    { wch: 32 }, { wch: 12 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];

  const wsBitacora = XLSX.utils.json_to_sheet(filasBitacora);
  wsBitacora['!cols'] = [
    { wch: 32 }, { wch: 12 }, { wch: 10 }, { wch: 50 },
  ];

  const wsInformes = XLSX.utils.json_to_sheet(filasInformes);
  wsInformes['!cols'] = [
    { wch: 32 }, { wch: 14 }, { wch: 12 }, { wch: 60 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsAsistencia, 'Asistencia');
  XLSX.utils.book_append_sheet(wb, wsPuntajes, 'Puntajes');
  XLSX.utils.book_append_sheet(wb, wsBitacora, 'Bitácora');
  XLSX.utils.book_append_sheet(wb, wsInformes, 'Informes');

  const filename = `asistencias_${fechaIni}_${fechaFin}.xlsx`;
  XLSX.writeFile(wb, filename);

  toast(`Archivo descargado: ${filename}`, 'success');
}
