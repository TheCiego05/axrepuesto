// ============================================================
// USUARIOS.JS
// ============================================================
let usuarioEditId = null;

async function cargarUsuarios() {
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
