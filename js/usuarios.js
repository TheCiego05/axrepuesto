// ============================================================
// USUARIOS.JS
// ============================================================
let usuarioEditId = null;

async function cargarUsuarios() {
  cargarAuditLog();
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
  const notaPassword = document.getElementById('usr-password-nota');
  const emailInput   = document.getElementById('usr-email');
  if (!id) {
    document.getElementById('usr-nombre').value = '';
    document.getElementById('usr-email').value  = '';
    document.getElementById('usr-rol').value    = '2';
    notaPassword.style.display = 'block';
    emailInput.disabled = false;
    abrirModal('modal-usuario');
    return;
  }
  dbGet('usuarios', id).then(u => {
    document.getElementById('usr-nombre').value = u.nombre||'';
    document.getElementById('usr-email').value  = u.email||'';
    document.getElementById('usr-rol').value    = u.rol_id||2;
    notaPassword.style.display = 'none';
    emailInput.disabled = true; // el email de Auth no se cambia desde aquí
    abrirModal('modal-usuario');
  });
}

async function editarUsuario(id) { abrirModalUsuario(id); }

async function guardarUsuario() {
  const btn    = document.querySelector('#modal-usuario .btn-primary');
  const nombre = document.getElementById('usr-nombre').value.trim();
  const email  = document.getElementById('usr-email').value.trim();
  const rolId  = parseInt(document.getElementById('usr-rol').value);
  if (!nombre || !email) { showToast('Nombre y email requeridos','error'); return; }

  btnLoading(btn, 'Guardando...');
  try {
    if (usuarioEditId) {
      await dbUpdate('usuarios', { id: usuarioEditId, nombre, rol_id: rolId });
      showToast('Usuario actualizado','success');
    } else {
      const { error } = await getClient().rpc('crear_usuario_con_auth', {
        p_email: email, p_nombre: nombre, p_rol_id: rolId,
      });
      if (error) { showToast('Error: ' + error.message, 'error'); return; }
      await enviarRecuperacionPassword(email);
      showToast('Usuario creado. Le enviamos un correo para configurar su contraseña.', 'success');
    }
    cerrarModal('modal-usuario');
    cargarUsuarios();
  } catch(err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btnReset(btn);
  }
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

