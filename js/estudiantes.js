// ============================================================
//  SEA · Gestión de Estudiantes
// ============================================================

async function initEstudiantes() {
  await cargarGruposEnSelect('est-filter-grupo');

  // Admin: mostrar botón nuevo estudiante
  const btnNuevo = document.getElementById('btn-nuevo-estudiante');
  if (isAdmin) {
    btnNuevo.classList.remove('hidden');
    btnNuevo.onclick = () => {
      document.getElementById('est-profesor').value = currentUser.email;
      openModal('Nuevo Estudiante');
    };
  } else {
    btnNuevo.classList.add('hidden');
  }

  document.getElementById('btn-buscar-estudiantes').onclick = cargarEstudiantes;
  document.getElementById('btn-modal-save').onclick = guardarEstudiante;

  // Búsqueda con Enter en el campo de texto
  document.getElementById('est-filter-buscar').onkeydown = (e) => {
    if (e.key === 'Enter') cargarEstudiantes();
  };

  // Auto-completar email del profesor para no-admins
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
            ${isAdmin ? '<th>Acciones</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${data.map(e => `
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
          `).join('')}
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

  document.getElementById('est-id').value         = data.id;
  document.getElementById('est-codigo').value     = data.codigo_estudiante;
  document.getElementById('est-nombre').value     = data.nombre_completo;
  document.getElementById('est-grupo').value      = data.curso_grupo;
  document.getElementById('est-tipo-curso').value = data.tipo_curso;
  document.getElementById('est-profesor').value   = data.profesor_email;
  document.getElementById('est-activo').checked   = data.activo;

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
  const id     = document.getElementById('est-id').value;
  const codigo = document.getElementById('est-codigo').value.trim();
  const nombre = document.getElementById('est-nombre').value.trim();
  const grupo  = document.getElementById('est-grupo').value.trim();
  const tipo   = document.getElementById('est-tipo-curso').value;
  const prof   = document.getElementById('est-profesor').value.trim();
  const activo = document.getElementById('est-activo').checked;

  if (!codigo || !nombre || !grupo || !tipo || !prof) {
    toast('Completa todos los campos obligatorios.', 'warning');
    return;
  }

  const payload = {
    codigo_estudiante: codigo,
    nombre_completo:   nombre,
    curso_grupo:       grupo.toUpperCase(),
    tipo_curso:        tipo,
    profesor_email:    prof.toLowerCase(),
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
  // Actualizar selects de grupo en otras vistas
  await cargarGruposEnSelect('reg-grupo');
  await cargarGruposEnSelect('hist-grupo');
  await cargarGruposEnSelect('est-filter-grupo');
}
