// ============================================================
//  SEA · Gestión de Estudiantes
// ============================================================

async function initEstudiantes() {
  await cargarGruposEnSelect('est-filter-grupo');
  await cargarGruposEnDatalist('grupos-datalist');
  await cargarProfesoresEnDatalist('profesores-datalist');

  const btnNuevo = document.getElementById('btn-nuevo-estudiante');
  const btnImportar = document.getElementById('btn-importar-excel');

  if (isAdmin) {
    btnNuevo.classList.remove('hidden');
    btnNuevo.onclick = () => {
      document.getElementById('est-profesor').value = currentUser.email;
      openModal('Nuevo Estudiante');
    };
    btnImportar.classList.remove('hidden');
    btnImportar.onclick = abrirImportador;
  } else {
    btnNuevo.classList.add('hidden');
    btnImportar.classList.add('hidden');
  }

  document.getElementById('btn-buscar-estudiantes').onclick = cargarEstudiantes;
  document.getElementById('btn-modal-save').onclick = guardarEstudiante;

  document.getElementById('est-filter-buscar').onkeydown = (e) => {
    if (e.key === 'Enter') cargarEstudiantes();
  };

  if (!isAdmin) {
    const inputProf = document.getElementById('est-profesor');
    if (inputProf) inputProf.value = currentUser.email;
  }
}

async function cargarEstudiantes() {
  const tipo   = document.getElementById('est-filter-tipo').value;
  const grupo  = document.getElementById('est-filter-grupo').value;
  const buscar = document.getElementById('est-filter-buscar').value.trim();

  const container = document.getElementById('estudiantes-table-container');
  container.innerHTML = '<div class="empty-state">Cargando...</div>';

  let query = db
    .from('estudiantes')
    .select('*')
    .order('nombre_completo');

  if (tipo)   query = query.eq('tipo_curso', tipo);
  if (grupo)  query = query.eq('curso_grupo', grupo);
  if (buscar) {
    query = query.or(
      `nombre_completo.ilike.%${buscar}%,codigo_estudiante.ilike.%${buscar}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    container.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
    return;
  }

  if (!data?.length) {
    container.innerHTML = '<div class="empty-state">Sin estudiantes con ese filtro.</div>';
    return;
  }

  // Contar inasistencias por estudiante.
  // Paginado porque Supabase devuelve máximo 1000 filas por consulta.
  const ids = data.map(e => e.id);
  const ausenciasMap = {};
  const PAGINA = 1000;
  for (let desde = 0; ; desde += PAGINA) {
    const { data: ausData } = await db
      .from('detalle_asistencias')
      .select('estudiante_id')
      .in('estudiante_id', ids)
      .eq('presente', false)
      .range(desde, desde + PAGINA - 1);

    ausData?.forEach(d => {
      ausenciasMap[d.estudiante_id] = (ausenciasMap[d.estudiante_id] || 0) + 1;
    });

    if (!ausData || ausData.length < PAGINA) break;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Grupo</th>
            <th>Tipo</th>
            <th>Profesor</th>
            <th>Estado</th>
            <th>Inasistencias</th>
            <th></th>
            ${isAdmin ? '<th>Acciones</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${data.map(e => {
            const inasistencias = ausenciasMap[e.id] || 0;
            const badgeColor = inasistencias >= 3 ? 'badge-red' : inasistencias >= 1 ? 'badge-amber' : 'badge-gray';
            return `
            <tr>
              <td style="font-family:monospace;font-size:12.5px">${e.codigo_estudiante}</td>
              <td><strong>${e.nombre_completo}</strong></td>
              <td>${e.curso_grupo}</td>
              <td>
                <span class="badge ${e.tipo_curso === 'Precálculo' ? 'badge-blue' : 'badge-green'}">
                  ${e.tipo_curso}
                </span>
              </td>
              <td style="font-size:12.5px;color:var(--text-muted)">${e.profesor_email}</td>
              <td>
                <span class="badge ${e.activo ? 'badge-green' : 'badge-gray'}">
                  ${e.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                <span class="badge ${badgeColor}">${inasistencias}</span>
              </td>
              <td>
                <button class="btn btn-ghost btn-sm"
                        data-id="${e.id}"
                        data-nombre="${e.nombre_completo.replace(/"/g, '&quot;')}"
                        onclick="mostrarEstadisticasEstudiante(this.dataset.id, this.dataset.nombre)">
                  📊 Ver
                </button>
              </td>
              ${isAdmin ? `
              <td>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-ghost btn-sm"
                          onclick="editarEstudiante('${e.id}')">Editar</button>
                  <button class="btn btn-ghost btn-sm"
                          style="color:var(--red)"
                          onclick="toggleActivoEstudiante('${e.id}', ${e.activo})">
                    ${e.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </td>` : ''}
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
    <div style="padding:12px 16px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border)">
      ${data.length} estudiante${data.length !== 1 ? 's' : ''}
    </div>
  `;
}

async function editarEstudiante(id) {
  const { data, error } = await db
    .from('estudiantes')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) { toast('No se pudo cargar el estudiante.', 'error'); return; }

  document.getElementById('est-id').value           = data.id;
  document.getElementById('est-codigo').value       = data.codigo_estudiante;
  document.getElementById('est-nombre').value       = data.nombre_completo;
  document.getElementById('est-grupo').value        = data.curso_grupo;
  document.getElementById('est-tipo-curso').value   = data.tipo_curso;
  document.getElementById('est-profesor').value     = data.profesor_email;
  document.getElementById('est-email').value        = data.email              || '';
  document.getElementById('est-dir-electron').value = data.direccion_electron || '';
  document.getElementById('est-telefono').value     = data.telefono_reside    || '';
  document.getElementById('est-programa-academico').value = data.programa_academico  || '';
  document.getElementById('est-ciudad-procedencia').value = data.ciudad_procedencia  || '';
  document.getElementById('est-fecha-nacimiento').value   = data.fecha_nacimiento    || '';
  document.getElementById('est-activo').checked     = data.activo;

  openModal('Editar Estudiante');
}

async function toggleActivoEstudiante(id, activo) {
  const accion = activo ? 'desactivar' : 'activar';
  if (!confirm(`¿Seguro que deseas ${accion} este estudiante?`)) return;

  const { error } = await db
    .from('estudiantes')
    .update({ activo: !activo })
    .eq('id', id);

  if (error) { toast('Error al actualizar: ' + error.message, 'error'); return; }

  toast(`Estudiante ${activo ? 'desactivado' : 'activado'}.`, 'success');
  await cargarEstudiantes();
}

async function guardarEstudiante() {
  const id          = document.getElementById('est-id').value;
  const codigo      = document.getElementById('est-codigo').value.trim();
  const nombre      = document.getElementById('est-nombre').value.trim();
  const grupo       = document.getElementById('est-grupo').value.trim();
  const tipo        = document.getElementById('est-tipo-curso').value;
  const prof        = document.getElementById('est-profesor').value.trim();
  const email       = document.getElementById('est-email').value.trim() || null;
  const dirElectron = document.getElementById('est-dir-electron').value.trim() || null;
  const telefono    = document.getElementById('est-telefono').value.trim() || null;
  const programaAcademico  = document.getElementById('est-programa-academico').value.trim() || null;
  const ciudadProcedencia  = document.getElementById('est-ciudad-procedencia').value.trim() || null;
  const fechaNacimiento    = document.getElementById('est-fecha-nacimiento').value || null;
  const activo      = document.getElementById('est-activo').checked;

  if (!codigo || !nombre || !grupo || !tipo || !prof) {
    toast('Completa todos los campos obligatorios.', 'warning');
    return;
  }

  const profEmail = prof.toLowerCase();

  if (!await esProfesorAutorizado(profEmail)) {
    toast(
      `"${profEmail}" no está en la lista de correos autorizados. ` +
      `Un correo mal escrito esconde al estudiante de su profesor.`,
      'error'
    );
    return;
  }

  const payload = {
    codigo_estudiante: codigo,
    nombre_completo:   nombre,
    curso_grupo:       grupo.toUpperCase(),
    tipo_curso:        tipo,
    profesor_email:    profEmail,
    email:             email,
    direccion_electron: dirElectron,
    telefono_reside:   telefono,
    programa_academico: programaAcademico,
    ciudad_procedencia: ciudadProcedencia,
    fecha_nacimiento:   fechaNacimiento,
    activo,
  };

  const btn = document.getElementById('btn-modal-save');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  let error;

  if (id) {
    ({ error } = await db.from('estudiantes').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('estudiantes').insert(payload));
  }

  btn.disabled = false;
  btn.textContent = 'Guardar';

  if (error) {
    toast('Error: ' + error.message, 'error');
    return;
  }

  toast(`Estudiante ${id ? 'actualizado' : 'registrado'} correctamente.`, 'success');
  closeModal();
  await cargarEstudiantes();
  await cargarGruposEnSelect('reg-grupo');
  await cargarGruposEnSelect('hist-grupo');
  await cargarGruposEnSelect('est-filter-grupo');
  await cargarGruposEnDatalist('grupos-datalist');
}
