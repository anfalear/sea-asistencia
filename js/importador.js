// ============================================================
//  SEA · Importador de estudiantes desde Excel (SIAE)
// ============================================================

let _importPreview = [];

function abrirImportador() {
  document.getElementById('modal-importador').classList.remove('hidden');
  document.getElementById('import-file').value = '';
  document.getElementById('import-profesor').value = '';
  document.getElementById('import-grupo').value = '';
  document.getElementById('import-tipo').value = '';
  document.getElementById('import-preview-section').classList.add('hidden');
  document.getElementById('import-result').classList.add('hidden');
  _importPreview = [];
}

function cerrarImportador() {
  document.getElementById('modal-importador').classList.add('hidden');
  _importPreview = [];
}

function procesarArchivoSIAE(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const wb   = XLSX.read(e.target.result, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const raw  = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!raw.length) {
      toast('El archivo está vacío o no tiene el formato esperado.', 'warning');
      return;
    }

    // Normalizar cabeceras: minúsculas y espacios → guion bajo
    const rows = raw.map(r => {
      const n = {};
      Object.keys(r).forEach(k => { n[k.trim().toLowerCase().replace(/\s+/g, '_')] = r[k]; });
      return n;
    });

    _importPreview = rows
      .map(r => {
        const p1 = String(r['primer_apellido']  || '').trim();
        const p2 = String(r['segundo_apellido'] || '').trim();
        const n1 = String(r['primer_nombre']    || '').trim();
        const n2 = String(r['segundo_nombre']   || '').trim();
        const nombre_completo = [p1, p2, n1, n2].filter(Boolean).join(' ');

        return {
          codigo_estudiante:  String(r['codigo_est']          || '').trim(),
          nombre_completo,
          programa:           String(r['programa_academico']  || '').trim(),
          email:              String(r['email']               || '').trim().toLowerCase() || null,
          direccion_electron: String(r['direccion_electron']  || '').trim().toLowerCase() || null,
          telefono_reside:    String(r['telefono_reside']     || '').trim() || null,
        };
      })
      .filter(r => r.codigo_estudiante && r.nombre_completo);

    if (!_importPreview.length) {
      toast('No se encontraron filas válidas. Verifica que las columnas coincidan con el formato SIAE.', 'warning');
      return;
    }

    renderPreviewImport();
  };
  reader.readAsArrayBuffer(file);
}

function renderPreviewImport() {
  const tbody = document.getElementById('import-tbody');
  tbody.innerHTML = _importPreview.map(r => `
    <tr>
      <td style="font-family:monospace;font-size:12px">${r.codigo_estudiante}</td>
      <td>${r.nombre_completo}</td>
      <td style="font-size:12px;color:var(--text-muted)">${r.programa}</td>
    </tr>
  `).join('');

  document.getElementById('import-count').textContent =
    `${_importPreview.length} estudiante${_importPreview.length !== 1 ? 's' : ''} detectado${_importPreview.length !== 1 ? 's' : ''}`;

  document.getElementById('import-preview-section').classList.remove('hidden');
  document.getElementById('import-result').classList.add('hidden');
}

async function ejecutarImportacion() {
  const profesor = document.getElementById('import-profesor').value.trim().toLowerCase();
  const grupo    = document.getElementById('import-grupo').value.trim().toUpperCase();
  const tipo     = document.getElementById('import-tipo').value;

  if (!profesor || !grupo || !tipo) {
    toast('Completa el email del profesor, el grupo y el tipo de curso antes de importar.', 'warning');
    return;
  }

  if (!_importPreview.length) {
    toast('Carga un archivo primero.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-confirmar-import');
  btn.disabled = true;
  btn.textContent = 'Importando...';

  const payload = _importPreview.map(r => ({
    codigo_estudiante:  r.codigo_estudiante,
    nombre_completo:    r.nombre_completo,
    curso_grupo:        grupo,
    tipo_curso:         tipo,
    profesor_email:     profesor,
    email:              r.email              || null,
    direccion_electron: r.direccion_electron || null,
    telefono_reside:    r.telefono_reside    || null,
    programa_academico: r.programa           || null,
    activo:             true,
  }));

  const { data, error } = await db
    .from('estudiantes')
    .upsert(payload, { onConflict: 'codigo_estudiante' })
    .select('id');

  btn.disabled = false;
  btn.textContent = 'Confirmar importación';

  if (error) {
    toast('Error en la importación: ' + error.message, 'error');
    return;
  }

  const n = data?.length ?? payload.length;
  const resultEl = document.getElementById('import-result');
  resultEl.innerHTML = `<span class="badge badge-green">✓ ${n} estudiante${n !== 1 ? 's' : ''} importado${n !== 1 ? 's' : ''}/actualizados en el grupo ${grupo}</span>`;
  resultEl.classList.remove('hidden');

  toast(`Importación completada: ${n} estudiantes en ${grupo}`, 'success');

  _importPreview = [];
  document.getElementById('import-file').value = '';
  document.getElementById('import-preview-section').classList.add('hidden');

  await cargarEstudiantes();
  await cargarGruposEnSelect('reg-grupo');
  await cargarGruposEnSelect('hist-grupo');
  await cargarGruposEnSelect('est-filter-grupo');
}
