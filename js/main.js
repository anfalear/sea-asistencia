// ============================================================
//  SEA · Inicialización de la aplicación
// ============================================================

// onAppReady es llamado desde auth.js al confirmar la sesión
async function onAppReady() {
  // Navegar a dashboard por defecto
  navigateTo('dashboard');
}

// Arrancar autenticación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});
