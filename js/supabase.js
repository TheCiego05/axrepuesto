// ============================================================
// SUPABASE CLIENT — Llave10
// Reemplaza IndexedDB completamente
// ============================================================

// ⚠️ CONFIGURAR ANTES DE USAR:
const SUPABASE_URL  = 'https://jzomiywgrnpflakblnlh.supabase.co';
const SUPABASE_KEY  = 'TU_ANON_KEY_AQUI'; // Settings → API → anon public

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

// ---- AUTENTICACIÓN SIMPLE ----
let usuarioActual = null;

// ---- SESIÓN TOKEN ----
function generarToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2,'0')).join('');
}

async function crearSesion(usuarioId) {
  const token = generarToken();
  const expira = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 horas
  await getClient().from('sesiones').insert({
    usuario_id: usuarioId,
    token,
    expira_en: expira.toISOString(),
    user_agent: navigator.userAgent.substring(0, 200),
  });
  sessionStorage.setItem('llave10_token', token);
  sessionStorage.setItem('llave10_token_expira', expira.toISOString());
  return token;
}

async function verificarSesionActiva() {
  const token   = sessionStorage.getItem('llave10_token');
  const expira  = sessionStorage.getItem('llave10_token_expira');
  if (!token || !expira) return false;
  if (new Date(expira) < new Date()) {
    await cerrarSesionToken(token);
    return false;
  }
  return true;
}

async function cerrarSesionToken(token) {
  const t = token || sessionStorage.getItem('llave10_token');
  if (t) {
    await getClient().from('sesiones').delete().eq('token', t);
  }
  sessionStorage.removeItem('llave10_token');
  sessionStorage.removeItem('llave10_token_expira');
}

// E2: Auto-expire session check
setInterval(async () => {
  const expira = sessionStorage.getItem('llave10_token_expira');
  if (expira && new Date(expira) < new Date()) {
    showToast('Sesión expirada. Vuelve a iniciar sesión.', 'error');
    setTimeout(() => logout(), 2000);
  }
}, 60000); // Check every minute

async function loginUsuario(email, password) {
  // E1: Verificar bloqueo con función mejorada
  try {
    const { data: bloqueado } = await getClient().rpc('esta_bloqueado', { p_email: email });
    if (bloqueado) {
      return { error: '🔒 Cuenta bloqueada temporalmente. Intenta de nuevo en 15 minutos.' };
    }
  } catch(e) { /* continuar si falla la verificación */ }

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

  if (error || !user) {
    // Registrar intento fallido con función mejorada
    try {
      const { data: resultado } = await getClient().rpc('registrar_intento_login', {
        p_email: email, p_exitoso: false
      });
      if (resultado?.bloqueado) {
        return { error: `🔒 Cuenta bloqueada por 15 minutos tras ${resultado.intentos} intentos fallidos.` };
      }
      const restantes = resultado?.restantes || 0;
      return { error: `Usuario no encontrado. ${restantes > 0 ? restantes + ' intento(s) restante(s).' : ''}` };
    } catch(e) {
      return { error: 'Usuario no encontrado.' };
    }
  }

  // Primera vez (sin password_hash) o verificar hash
  if (user.password_hash && user.password_hash !== hash) {
    try {
      const { data: resultado } = await getClient().rpc('registrar_intento_login', {
        p_email: email, p_exitoso: false
      });
      if (resultado?.bloqueado) {
        return { error: `🔒 Cuenta bloqueada por 15 minutos.` };
      }
      const restantes = resultado?.restantes || 0;
      return { error: `Contraseña incorrecta. ${restantes > 0 ? restantes + ' intento(s) restante(s).' : 'Cuenta será bloqueada.'}` };
    } catch(e) {
      return { error: 'Contraseña incorrecta.' };
    }
  }

  // Login exitoso - registrar y crear sesión
  try {
    await getClient().rpc('registrar_intento_login', { p_email: email, p_exitoso: true });
  } catch(e) {}

  if (!user.password_hash) {
    await getClient().from('usuarios')
      .update({ password_hash: hash, ultimo_acceso: new Date().toISOString() })
      .eq('id', user.id);
  } else {
    await getClient().from('usuarios')
      .update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id);
  }

  // E2: Crear token de sesión con expiración 8 horas
  await crearSesion(user.id);

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
  await cerrarSesionToken();
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
