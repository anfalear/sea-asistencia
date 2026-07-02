// ============================================================
//  SEA · Informes de estudiante por periodo
// ============================================================

async function initInformes() {
  await cargarGruposEnSelect('inf-grupo');

  document.getElementById('inf-grupo').onchange = onCambioGrupoInforme;
  document.getElementById('inf-estudiante').onchange = onCambioSeleccionInforme;
  document.getElementById('inf-periodo').onchange = onCambioSeleccionInforme;
  document.getElementById('btn-guardar-informe').onclick = guardarInforme;

  const select = document.getElementById('inf-estudiante');
  select.innerHTML = '<option value="">Selecciona un grupo primero...</option>';
  select.disabled = true;
  document.getElementById('inf-desempeno').value = '';
  document.getElementById('inf-existente-msg').classList.add('hidden');
}

async function onCambioGrupoInforme() {
  const grupo = document.getElementById('inf-grupo').value;
  const select = document.getElementById('inf-estudiante');

  document.getElementById('inf-desempeno').value = '';
  document.getElementById('inf-existente-msg').classList.add('hidden');

  if (!grupo) {
    select.innerHTML = '<option value="">Selecciona un grupo primero...</option>';
    select.disabled = true;
    return;
  }

  const { data, error } = await db
    .from('estudiantes')
    .select('id, codigo_estudiante, nombre_completo')
    .eq('curso_grupo', grupo)
    .eq('activo', true)
    .order('nombre_completo');

  if (error || !data?.length) {
    select.innerHTML = '<option value="">Sin estudiantes en este grupo</option>';
    select.disabled = true;
    return;
  }

  select.innerHTML = '<option value="">Seleccionar estudiante...</option>' +
    data.map(e => `<option value="${e.id}">${escapeHtml(e.nombre_completo)} (${e.codigo_estudiante})</option>`).join('');
  select.disabled = false;
}

async function onCambioSeleccionInforme() {
  const estudianteId = document.getElementById('inf-estudiante').value;
  const periodo = document.getElementById('inf-periodo').value.trim();
  if (!estudianteId || !periodo) return;
  await cargarInforme(estudianteId, periodo);
}

async function cargarInforme(estudianteId, periodo) {
  const msgEl = document.getElementById('inf-existente-msg');
  const textarea = document.getElementById('inf-desempeno');

  const { data, error } = await db
    .from('informes_estudiante')
    .select('desempeno_general')
    .eq('estudiante_id', estudianteId)
    .eq('periodo', periodo)
    .maybeSingle();

  if (error) {
    toast('Error al buscar el informe: ' + error.message, 'error');
    return;
  }

  if (data) {
    textarea.value = data.desempeno_general || '';
    msgEl.textContent = 'Ya existe un informe para este estudiante en este periodo. Al guardar se actualizará.';
    msgEl.style.cssText = 'padding:10px 14px;border-radius:8px;background:var(--amber-bg);color:var(--amber);font-size:13px';
    msgEl.classList.remove('hidden');
  } else {
    textarea.value = '';
    msgEl.classList.add('hidden');
  }
}

async function guardarInforme() {
  const estudianteId = document.getElementById('inf-estudiante').value;
  const periodo = document.getElementById('inf-periodo').value.trim();
  const desempeno = document.getElementById('inf-desempeno').value.trim();

  if (!estudianteId || !periodo) {
    toast('Selecciona un estudiante e ingresa el periodo antes de guardar.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-guardar-informe');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const payload = {
    estudiante_id:      estudianteId,
    periodo,
    desempeno_general:  desempeno || null,
    profesor_email:     currentUser.email,
  };

  const { error } = await db
    .from('informes_estudiante')
    .upsert(payload, { onConflict: 'estudiante_id, periodo' });

  btn.disabled = false;
  btn.textContent = 'Guardar Informe';

  if (error) {
    toast('Error al guardar el informe: ' + error.message, 'error');
    return;
  }

  toast('Informe guardado correctamente.', 'success');
  await cargarInforme(estudianteId, periodo);
}
