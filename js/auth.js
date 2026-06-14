// ============================================================
//  SEA · Autenticación (Google OAuth + lista blanca)
// ============================================================

async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    const autorizado = await verificarWhitelist(session.user.email);
    if (autorizado) {
      setCurrentUser(session.user);
      showApp();
    } else {
      await db.auth.signOut();
      showLogin('Tu cuenta no está autorizada para acceder al sistema.');
    }
  } else {
    showLogin();
  }

  db.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      const autorizado = await verificarWhitelist(session.user.email);
      if (autorizado) {
        setCurrentUser(session.user);
        showApp();
      } else {
        await db.auth.signOut();
        showLogin('Tu cuenta no está autorizada para acceder al sistema.');
      }
    } else {
      setCurrentUser(null);
      showLogin();
    }
  });
}

async function verificarWhitelist(email) {
  const { data, error } = await db
    .from('email_whitelist')
    .select('email')
    .eq('email', email)
    .maybeSingle();
  if (error) {
    console.error('[SEA] Whitelist query error:', error.code, error.message);
  }
  return data !== null;
}

async function loginConGoogle() {
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });
  if (error) {
    const msg = document.getElementById('login-message');
    msg.textContent = 'Error al iniciar sesión: ' + error.message;
    msg.className = 'login-message error';
  }
}

async function logout() {
  await db.auth.signOut();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-google-login').addEventListener('click', loginConGoogle);
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await logout();
  });
});

function showLogin(errorMsg = '') {
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('screen-app').classList.add('hidden');
  const msg = document.getElementById('login-message');
  if (errorMsg) {
    msg.textContent = errorMsg;
    msg.className = 'login-message error';
  } else {
    msg.className = 'login-message hidden';
  }
}

function showApp() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');

  const email = currentUser?.email || '';
  const name  = currentUser?.user_metadata?.full_name || '';
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : email.substring(0, 2).toUpperCase();

  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('user-email').textContent  = email;
  document.getElementById('user-role').textContent   = isAdmin ? 'Administrador' : 'Profesor';

  if (!isAdmin) {
    document.getElementById('btn-nuevo-estudiante')?.classList.add('hidden');
    document.getElementById('btn-importar-excel')?.classList.add('hidden');
  }

  onAppReady();
}
