// ============================================================
//  SEA Matemáticas UIS · Configuración Supabase
//  Credenciales cargadas desde js/env.js (no versionado).
//  Copia js/env.example.js → js/env.js y rellena tus valores.
// ============================================================

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado global de la sesión
let currentUser = null;
let isAdmin = false;

function setCurrentUser(user) {
  currentUser = user;
  isAdmin = user?.email === ADMIN_EMAIL;
}
