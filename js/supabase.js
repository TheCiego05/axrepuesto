// ============================================================
// SUPABASE CLIENT — Llave10
// Reemplaza IndexedDB completamente
// ============================================================

// ⚠️ CONFIGURAR ANTES DE USAR:
const SUPABASE_URL  = 'https://jzomiywgrnpflakblnlh.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6b21peXdncm5wZmxha2JsbmxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1NzkyODcsImV4cCI6MjEwMjE1NTI4N30.1sw15auGufaKIcUiW317knzB0hksoyS-BDhx7KZZWew'; // Settings → API → anon public

let _supabase = null;

function getClient() {
  if (!_supabase) {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return _supabase;
}

// ---- CRUD genérico ----
async function dbAdd(table, data) {
  const { data: result, error } = await getClient()
    .from(table)
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result.id;
}

async function dbGetAll(table, filtros = {}) {
  let query = getClient().from(table).select('*').order('id', { ascending: false });
  Object.entries(filtros).forEach(([col, val]) => { query = query.eq(col, val); });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function dbGet(table, id) {
  const { data, error } = await getClient()
    .from(table).select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

async function dbUpdate(table, data) {
  const { id, ...rest } = data;
  const { error } = await getClient()
    .from(table).update(rest).eq('id', id);
  if (error) throw error;
  return true;
}

async function dbDelete(table, id) {
  const { error } = await getClient()
    .from(table).delete().eq('id', id);
  if (error) throw error;
  return true;
}

async function dbGetByIndex(table, col, value) {
  const { data, error } = await getClient()
    .from(table).select('*').eq(col, value).order('id');
  if (error) throw error;
  return data || [];
}

async function dbSearch(table, col, term) {
  const { data, error } = await getClient()
    .from(table).select('*').ilike(col, `%${term}%`).order('id');
  if (error) throw error;
  return data || [];
}

// ---- CONFIG ----
async function getConfig(key) {
  const { data } = await getClient()
    .from('config').select('value').eq('key', key).single();
  return data?.value || null;
}

async function setConfig(key, value) {
  const { error } = await getClient()
    .from('config').upsert({ key, value });
  if (error) throw error;
}

// ---- SECUENCIAS NCF / e-CF ----
async function getSiguienteNCF(tipo) {
  const { data: sec, error } = await getClient()
    .from('secuencias').select('*').eq('tipo', tipo).single();
  if (error || !sec) return null;
  if (sec.actual > sec.hasta) return null;

  const num = sec.actual;
  await getClient().from('secuencias')
    .update({ actual: num + 1 }).eq('tipo', tipo);

  if (tipo.startsWith('e')) {
    return 'E' + tipo.substring(1) + String(num).padStart(10, '0');
  }
  return tipo + String(num).padStart(8, '0');
}

async function generarNumeroFactura() {
  const { count } = await getClient()
    .from('facturas').select('*', { count: 'exact', head: true });
  return 'FAC-' + String((count || 0) + 1).padStart(6, '0');
}

// ---- AUTENTICACIÓN SIMPLE ----
let usuarioActual = null;

async function loginUsuario(email, password) {
  // Auth simple con hash SHA-256
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');

  const { data: user, error } = await getClient()
    .from('usuarios')
    .select('*, roles(nombre, permisos)')
    .eq('email', email)
    .eq('activo', true)
    .single();

  if (error || !user) return { error: 'Usuario no encontrado' };

  // Primera vez (sin password_hash) o verificar hash
  if (user.password_hash && user.password_hash !== hash) {
    return { error: 'Contraseña incorrecta' };
  }

  // Si es primera vez, guardar el hash
  if (!user.password_hash) {
    await getClient().from('usuarios')
      .update({ password_hash: hash, ultimo_acceso: new Date().toISOString() })
      .eq('id', user.id);
  } else {
    await getClient().from('usuarios')
      .update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id);
  }

  usuarioActual = user;
  sessionStorage.setItem('llave10_user', JSON.stringify(user));
  return { user };
}

function getUsuarioActual() {
  if (usuarioActual) return usuarioActual;
  const saved = sessionStorage.getItem('llave10_user');
  if (saved) { usuarioActual = JSON.parse(saved); return usuarioActual; }
  return null;
}

function logout() {
  usuarioActual = null;
  sessionStorage.removeItem('llave10_user');
  mostrarLogin();
}

function tienePermiso(permiso) {
  const u = getUsuarioActual();
  if (!u) return false;
  const permisos = u.roles?.permisos || {};
  if (permisos.todo) return true;
  return !!permisos[permiso];
}

function esRol(...roles) {
  const u = getUsuarioActual();
  if (!u) return false;
  return roles.includes(u.roles?.nombre);
}
