// ============================================================
//  SEA Matemáticas UIS · Configuración Supabase
// ============================================================

const SUPABASE_URL     = 'https://fqbsyywbjgasscnnsmvu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_exUTEo8Q1L6O-O0n3rqEyA_WjYVihqh';
const ADMIN_EMAIL       = 'aflaok10@gmail.com';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado global de la sesión
let currentUser = null;
let isAdmin = false;

function setCurrentUser(user) {
  currentUser = user;
  isAdmin = user?.email === ADMIN_EMAIL;
}
