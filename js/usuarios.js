// ============================================================
// USUARIOS.JS
// ============================================================
let usuarioEditId = null;

async function cargarUsuarios() {
  cargarAuditLog();
  cargarSesionesActivas();
  const u = getUsuarioActual();
  if (!esRol('super_admin','gerente')) {
    document.getElementById('usuarios-tbody').innerHTML =
      '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text2)">Sin permisos</td></tr>';
    return;
  }
  const usuarios = await dbGetAll('usuarios');
  const tbody    = document.getElementById('usuarios-tbody');
  if (!usuarios.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="ico">👤</div><h3>Sin usuarios</h3></div></td></tr>';
    return;
  }
  tbody.innerHTML = usuarios.map(u => `
    <tr>
      <td><strong>${u.nombre}</strong></td>
      <td class="text-sm">${u.email}</td>
      <td>${badgeRol(u.rol_id)}</td>
      <td class="text-sm text-muted">${u.ultimo_acceso ? formatDate(u.ultimo_acceso) : '—'}</td>
      <td>${u.activo ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-red">Inactivo</span>'}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-xs btn-ghost" onclick="editarUsuario(${u.id})">✏️</button>
          <button class="btn btn-xs btn-danger" onclick="toggleUsuario(${u.id},${!u.activo})">${u.activo?'🔒 Desactivar':'🔓 Activar'}</button>
        </div>
      </td>
    </tr>`).join('');
}

function badgeRol(rolId) {
  const map = { 1:'<span class="badge badge-red">Super Admin</span>', 2:'<span class="badge badge-yellow">Gerente</span>', 3:'<span class="badge badge-blue">Secretaria</span>', 4:'<span class="badge badge-gray">Mecánico</span>' };
  return map[rolId] || `<span class="badge badge-gray">${rolId}</span>`;
}

function abrirModalUsuario(id=null) {
  usuarioEditId = id;
  document.getElementById('modal-usuario-titulo').textContent = id ? 'Editar Usuario' : 'Nuevo Usuario';
  if (!id) { document.querySelector('#modal-usuario .form-grid').reset?.(); abrirModal('modal-usuario'); return; }
  dbGet('usuarios', id).then(u => {
    document.getElementById('usr-nombre').value   = u.nombre||'';
    document.getElementById('usr-email').value    = u.email||'';
    document.getElementById('usr-rol').value      = u.rol_id||2;
    document.getElementById('usr-password').value = '';
    abrirModal('modal-usuario');
  });
}

async function editarUsuario(id) { abrirModalUsuario(id); }

async function guardarUsuario() {
  const nombre   = document.getElementById('usr-nombre').value.trim();
  const email    = document.getElementById('usr-email').value.trim();
  const rolId    = parseInt(document.getElementById('usr-rol').value);
  const password = document.getElementById('usr-password').value;
  if (!nombre || !email) { showToast('Nombre y email requeridos','error'); return; }

  let passwordHash = null;
  if (password) {
    const enc  = new TextEncoder();
    const buf  = await crypto.subtle.digest('SHA-256', enc.encode(password));
    passwordHash = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  const data = { nombre, email, rol_id: rolId, activo: true };
  if (passwordHash) data.password_hash = passwordHash;

  if (usuarioEditId) {
    await dbUpdate('usuarios', { ...data, id: usuarioEditId });
    showToast('Usuario actualizado','success');
  } else {
    await dbAdd('usuarios', data);
    showToast('Usuario creado','success');
  }
  cerrarModal('modal-usuario');
  cargarUsuarios();
}

async function toggleUsuario(id, nuevoEstado) {
  const u = await dbGet('usuarios', id);
  await dbUpdate('usuarios', { ...u, activo: nuevoEstado });
  showToast(nuevoEstado ? 'Usuario activado' : 'Usuario desactivado', 'info');
  cargarUsuarios();
}

// ---- AUDIT LOG ----
async function cargarAuditLog() {
  const lista = document.getElementById('audit-log-lista');
  if (!lista) return;
  lista.innerHTML = skeletonCards(3);

  try {
    const { data, error } = await getClient()
      .from('auditoria')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(20);

    if (error || !data?.length) {
      lista.innerHTML = emptyState('📋', 'Sin registros', 'Las acciones del sistema aparecerán aquí');
      return;
    }

    lista.innerHTML = data.map(log => `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
        <span style="flex-shrink:0;font-size:1rem">${iconAudit(log.accion)}</span>
        <div style="flex:1">
          <strong>${log.usuario_nombre || 'Sistema'}</strong>
          <span class="text-muted"> · ${log.accion}${log.tabla ? ' en ' + log.tabla : ''}</span>
        </div>
        <span class="text-muted text-xs">${formatDateTime(log.creado_en)}</span>
      </div>`).join('');
  } catch(e) {
    lista.innerHTML = '<p class="text-sm text-muted">Error cargando log</p>';
  }
}

function iconAudit(accion) {
  const map = { LOGIN:'🔑', LOGOUT:'🚪', CREATE:'➕', UPDATE:'✏️', DELETE:'🗑️' };
  return map[accion] || '📌';
}

// ---- SESIONES ACTIVAS ----
async function cargarSesionesActivas() {
  const lista = document.getElementById('sesiones-lista');
  if (!lista) return;

  try {
    const { data } = await getClient()
      .from('sesiones')
      .select('*, usuarios(nombre, email)')
      .gt('expira_en', new Date().toISOString())
      .order('creado_en', { ascending: false });

    if (!data?.length) {
      lista.innerHTML = '<p class="text-sm text-muted">Sin sesiones activas</p>';
      return;
    }

    lista.innerHTML = data.map(s => `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
        <div class="avatar" style="width:28px;height:28px;border-radius:6px;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">
          ${(s.usuarios?.nombre||'?').charAt(0).toUpperCase()}
        </div>
        <div style="flex:1">
          <strong>${s.usuarios?.nombre || '—'}</strong>
          <span class="text-muted"> · ${s.usuarios?.email || ''}</span>
          <div class="text-xs text-muted">Expira: ${formatDateTime(s.expira_en)}</div>
        </div>
        <button class="btn btn-xs btn-danger" onclick="cerrarSesion('${s.token}')">Cerrar</button>
      </div>`).join('');
  } catch(e) {
    lista.innerHTML = '<p class="text-sm text-muted">Error cargando sesiones</p>';
  }
}

async function cerrarSesion(token) {
  await getClient().from('sesiones').delete().eq('token', token);
  showToast('Sesión cerrada', 'info');
  cargarSesionesActivas();
}

async function cerrarTodasSesiones() {
  if (!await confirmar('¿Cerrar todas las sesiones activas? Todos los usuarios deberán volver a iniciar sesión.')) return;
  const u = getUsuarioActual();
  const miToken = sessionStorage.getItem('llave10_token');
  // Keep current session, close all others
  await getClient().from('sesiones')
    .delete()
    .neq('token', miToken || '');
  showToast('Todas las sesiones cerradas', 'info');
  cargarSesionesActivas();
}
