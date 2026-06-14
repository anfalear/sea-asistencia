// ============================================================
//  SEA · UI helpers: navegación, toasts, modal, utilidades
// ============================================================

const VIEW_TITLES = {
  dashboard:   'Dashboard',
  registro:    'Registro de Asistencia',
  historial:   'Historial',
  estudiantes: 'Estudiantes',
  alertas:     'Alertas',
};

// ---- Navegación ----

function navigateTo(view) {
  // Activar sección (también quitar 'hidden' por si estaba en el HTML inicial)
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + view);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }

  // Activar nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  // Título topbar
  document.getElementById('topbar-title').textContent = VIEW_TITLES[view] || view;

  // Cerrar sidebar en mobile
  document.getElementById('sidebar').classList.remove('open');

  // Cargar datos de la vista
  switch (view) {
    case 'dashboard':   loadDashboard();   break;
    case 'registro':    initRegistro();    break;
    case 'historial':   initHistorial();   break;
    case 'estudiantes': initEstudiantes(); break;
    case 'alertas':     loadAlertas();     break;
  }
}

// ---- Fecha de hoy ----

function todayISO() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function updateDateBadge() {
  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('date-today').textContent =
    now.toLocaleDateString('es-CO', opts);
}

// ---- Toasts ----

function toast(message, type = 'default', duration = 3500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', default: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || icons.default}</span> ${message}`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 220);
  }, duration);
}

// ---- Loading ----

function setLoading(containerId, loading) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (loading) {
    el.innerHTML = '<div class="empty-state">Cargando...</div>';
  }
}

// ---- Modal estudiante ----

function openModal(title = 'Nuevo Estudiante') {
  document.getElementById('modal-estudiante-title').textContent = title;
  document.getElementById('modal-estudiante').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-estudiante').classList.add('hidden');
  document.getElementById('form-estudiante').reset();
  document.getElementById('est-id').value = '';
  document.getElementById('est-activo').checked = true;
}

// ---- Helpers de tabla ----

function emptyRow(cols, text = 'Sin registros') {
  return `<tr><td colspan="${cols}" class="empty-state">${text}</td></tr>`;
}

function alertBadges(row) {
  let html = '';
  if (row.alerta_precalculo) html += '<span class="badge badge-red">Didáctica del Cálculo</span> ';
  if (row.alerta_psicologia) html += '<span class="badge badge-amber">Psicología</span>';
  return html || '<span class="badge badge-gray">—</span>';
}

// ---- Wiring sidebar & topbar ----

document.addEventListener('DOMContentLoaded', () => {
  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.view);
    });
  });

  // Sidebar toggle (mobile)
  document.getElementById('btn-menu').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
  });
  document.getElementById('btn-sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Modal close
  document.getElementById('btn-modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
  document.querySelector('.modal-overlay')?.addEventListener('click', closeModal);

  // Instructivo
  document.getElementById('btn-instructivo').addEventListener('click', () => {
    document.getElementById('modal-instructivo').classList.remove('hidden');
  });
  document.getElementById('btn-instructivo-close').addEventListener('click', () => {
    document.getElementById('modal-instructivo').classList.add('hidden');
  });
  document.getElementById('btn-instructivo-ok').addEventListener('click', () => {
    document.getElementById('modal-instructivo').classList.add('hidden');
  });

  // Tabs de alertas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.remove('active');
        c.classList.add('hidden');
      });
      btn.classList.add('active');
      const tab = document.getElementById('alertas-tab-' + btn.dataset.tab);
      tab.classList.add('active');
      tab.classList.remove('hidden');
    });
  });

  updateDateBadge();
});
