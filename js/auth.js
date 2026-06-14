// ============================================================
//  SEA · Autenticación (Google OAuth + lista blanca)
// ============================================================

// Flag para propagar el mensaje de "no autorizado" al evento SIGNED_OUT
// que dispara el signOut() inmediato al fallar la whitelist.
let _noAutorizado = false;

async function initAuth() {
  // Supabase v2 recomienda suscribirse a onAuthStateChange ANTES de llamar
  // a getSession(). En flujo PKCE (OAuth redirect), INITIAL_SESSION puede
  // llegar con null mientras el código se intercambia; SIGNED_IN llega
  // cuando el intercambio termina. No usar getSession() evita la carrera.
  db.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      const autorizado = await verificarWhitelist(session.user.email);
      if (autorizado) {
        _noAutorizado = false;
        setCurrentUser(session.user);
        showApp();
      } else {
        _noAutorizado = true;
        await db.auth.signOut(); // dispara SIGNED_OUT → rama else
      }
    } else {
      setCurrentUser(null);
      const msg = _noAutorizado
        ? 'Tu cuenta no está autorizada. Contacta al administrador.'
        : '';
      _noAutorizado = false;
      showLogin(msg);
    }
  });
}

async function verificarWhitelist(email) {
  const { data, error } = await db
    .from('email_whitelist')
    .select('email')
    .eq('email', email)
    .maybeSingle();
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
