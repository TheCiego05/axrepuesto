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
  // secuencias uses 'tipo' as PK, not 'id'
  const orderCol = table === 'secuencias' ? 'tipo' : 'id';
  let query = getClient().from(table).select('*').order(orderCol, { ascending: false });
  Object.entries(filtros).forEach(([col, val]) => { query = query.eq(col, val); });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function dbGet(table, id) {
  // secuencias uses 'tipo' as primary key, not 'id'
  const pkCol = table === 'secuencias' ? 'tipo' : 'id';
  const { data, error } = await getClient()
    .from(table).select('*').eq(pkCol, id).single();
  if (error) return null;
  return data;
}

async function dbUpdate(table, data) {
  const { id, ...rest } = data;
  // secuencias uses 'tipo' as primary key
  const pkCol = table === 'secuencias' ? 'tipo' : 'id';
  const pkVal = table === 'secuencias' ? data.tipo : id;
  const { error } = await getClient()
    .from(table).update(rest).eq(pkCol, pkVal);
  if (error) throw error;
  return true;
}

async function dbDelete(table, id) {
  const pkCol = table === 'secuencias' ? 'tipo' : 'id';
  const { error } = await getClient()
    .from(table).delete().eq(pkCol, id);
  if (error) throw error;
  return true;
}

async function dbGetByIndex(table, col, value) {
  const { data, error } = await getClient()
    .from(table).select('*').eq(col, value).order(table === 'secuencias' ? 'tipo' : 'id');
  if (error) throw error;
  return data || [];
}

async function dbSearch(table, col, term) {
  const { data, error } = await getClient()
    .from(table).select('*').ilike(col, `%${term}%`).order(table === 'secuencias' ? 'tipo' : 'id');
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
  const sec = await getSecuencia(tipo);
  if (!sec) return null;
  if (sec.actual > sec.hasta) return null;

  const num = sec.actual;
  await getClient().from('secuencias')
    .update({ actual: num + 1 }).eq('tipo', tipo);

  if (tipo.startsWith('e')) {
    return 'E' + tipo.substring(1) + String(num).padStart(10, '0');
  }
  return tipo + String(num).padStart(8, '0');
}


// Special getter for secuencias table (PK is 'tipo' not 'id')
async function getSecuencia(tipo) {
  const { data, error } = await getClient()
    .from('secuencias').select('*').eq('tipo', tipo).single();
  if (error) return null;
  return data;
}

async function updateSecuencia(data) {
  const { tipo, ...rest } = data;
  const { error } = await getClient()
    .from('secuencias').update(rest).eq('tipo', tipo);
  if (error) throw error;
  return true;
}

async function upsertSecuencia(data) {
  const { error } = await getClient()
    .from('secuencias').upsert(data, { onConflict: 'tipo' });
  if (error) throw error;
  return true;
}

async function generarNumeroFactura() {
  const { count } = await getClient()
    .from('facturas').select('*', { count: 'exact', head: true });
  return 'FAC-' + String((count || 0) + 1).padStart(6, '0');
}

// ---- AUTENTICACIÓN (Supabase Auth) ----
let usuarioActual = null;

// Trae el perfil de la app (roles, permisos, nombre) para un usuario ya
// autenticado en Supabase Auth, enlazado por usuarios.auth_user_id.
async function cargarPerfilUsuario(authUser) {
  const { data: perfil, error } = await getClient()
    .from('usuarios')
    .select('*, roles(nombre, permisos)')
    .eq('auth_user_id', authUser.id)
    .single();
  if (error || !perfil) return null;
  return perfil;
}

// Se llama una vez al cargar la app para restaurar la sesión de Supabase
// Auth (si existe) antes de decidir si se muestra el login o la app.
async function initAuth() {
  const { data: { session } } = await getClient().auth.getSession();
  if (!session) return null;

  const perfil = await cargarPerfilUsuario(session.user);
  if (!perfil || perfil.activo === false) {
    await getClient().auth.signOut();
    return null;
  }
  usuarioActual = perfil;
  return perfil;
}

async function loginUsuario(email, password) {
  // Verificar bloqueo por intentos fallidos
  try {
    const { data: bloqueado } = await getClient().rpc('esta_bloqueado', { p_email: email });
    if (bloqueado) {
      return { error: '🔒 Cuenta bloqueada temporalmente. Intenta de nuevo en 15 minutos.' };
    }
  } catch(e) { /* continuar si falla la verificación */ }

  const { data, error } = await getClient().auth.signInWithPassword({ email, password });

  if (error) {
    try {
      const { data: resultado } = await getClient().rpc('registrar_intento_login', {
        p_email: email, p_exitoso: false
      });
      if (resultado?.bloqueado) {
        return { error: `🔒 Cuenta bloqueada por 15 minutos tras ${resultado.intentos} intentos fallidos.` };
      }
      const restantes = resultado?.restantes || 0;
      return { error: `Correo o contraseña incorrectos. ${restantes > 0 ? restantes + ' intento(s) restante(s).' : ''}` };
    } catch(e) {
      return { error: 'Correo o contraseña incorrectos.' };
    }
  }

  const perfil = await cargarPerfilUsuario(data.user);
  if (!perfil) {
    await getClient().auth.signOut();
    return { error: 'Tu cuenta no tiene un perfil asociado en el sistema. Contacta al administrador.' };
  }
  if (perfil.activo === false) {
    await getClient().auth.signOut();
    return { error: 'Tu cuenta está desactivada. Contacta al administrador.' };
  }

  try { await getClient().rpc('registrar_intento_login', { p_email: email, p_exitoso: true }); } catch(e) {}
  await getClient().from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', perfil.id);

  usuarioActual = perfil;
  return { user: perfil };
}

async function enviarRecuperacionPassword(email) {
  const { error } = await getClient().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) return { error: 'No se pudo enviar el correo. Verifica el email e intenta de nuevo.' };
  return { ok: true };
}

async function actualizarPasswordPropia(nuevaPassword) {
  const { error } = await getClient().auth.updateUser({ password: nuevaPassword });
  if (error) return { error: error.message.includes('6 characters') ? 'La contraseña debe tener al menos 6 caracteres.' : 'No se pudo actualizar la contraseña.' };
  return { ok: true };
}

function getUsuarioActual() {
  return usuarioActual;
}

// ---- AUDITORÍA ----
async function registrarAuditoria(accion, tabla = null, registroId = null, detalle = {}) {
  const u = getUsuarioActual();
  try {
    await getClient().from('auditoria').insert({
      usuario_id:     u?.id || null,
      usuario_nombre: u?.nombre || 'Sistema',
      accion,
      tabla,
      registro_id:    registroId,
      detalle,
    });
  } catch(e) { /* silencioso */ }
}

async function logout() {
  registrarAuditoria('LOGOUT');
  await getClient().auth.signOut();
  usuarioActual = null;
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
