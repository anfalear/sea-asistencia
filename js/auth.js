// ============================================================
//  SEA · Autenticación (Supabase Magic Link)
// ============================================================

async function initAuth() {
  // Si llega con token en el hash (callback del magic link), Supabase lo procesa solo
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    setCurrentUser(session.user);
    showApp();
  } else {
    showLogin();
  }

  db.auth.onAuthStateChange((_event, session) => {
    if (session) {
      setCurrentUser(session.user);
      showApp();
    } else {
      setCurrentUser(null);
      showLogin();
    }
  });
}

async function sendMagicLink(email) {
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo }
  });
  return error;
}

async function logout() {
  await db.auth.signOut();
}

// ---- Wiring eventos de login ----
document.addEventListener('DOMContentLoaded', () => {
  const form    = document.getElementById('form-login');
  const input   = document.getElementById('login-email');
  const btnSend = document.getElementById('btn-login');
  const msg     = document.getElementById('login-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!email) return;

    btnSend.disabled = true;
    btnSend.textContent = 'Enviando...';
    msg.className = 'login-message hidden';

    const error = await sendMagicLink(email);

    btnSend.disabled = false;
    btnSend.textContent = 'Enviar enlace de acceso';

    if (error) {
      msg.textContent = 'Error al enviar el enlace: ' + error.message;
      msg.className = 'login-message error';
    } else {
      msg.innerHTML = `✓ Enlace enviado a <strong>${email}</strong><br>
        Revisa tu bandeja de entrada y haz clic en el enlace.`;
      msg.className = 'login-message success';
      input.value = '';
    }
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await logout();
  });
});

function showLogin() {
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('screen-app').classList.add('hidden');
}

function showApp() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');

  // Mostrar info del usuario
  const email = currentUser?.email || '';
  const initials = email.substring(0, 2).toUpperCase();
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('user-email').textContent  = email;
  document.getElementById('user-role').textContent   = isAdmin ? 'Administrador' : 'Profesor';

  // Restringir nav si no es admin (aunque RLS ya protege el backend)
  if (!isAdmin) {
    document.getElementById('btn-nuevo-estudiante')?.classList.add('hidden');
  }

  onAppReady();
}
