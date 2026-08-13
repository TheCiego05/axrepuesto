// ============================================================
// AUTH.JS — Login, roles y protección de rutas
// ============================================================

function mostrarLogin() {
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').textContent = '';
}

function mostrarApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  renderUserBadge();
  aplicarPermisosPorRol();
}

function renderUserBadge() {
  const u = getUsuarioActual();
  if (!u) return;
  const rol = u.roles?.nombre || 'usuario';
  const inicial = u.nombre.charAt(0).toUpperCase();
  const badge = document.getElementById('user-badge');
  if (badge) {
    badge.innerHTML = `
      <div class="avatar">${inicial}</div>
      <div class="info">
        <strong>${u.nombre}</strong>
        <span>${rolLabel(rol)}</span>
      </div>
    `;
  }
}

function rolLabel(rol) {
  return { super_admin:'Super Admin', gerente:'Gerente', secretaria:'Secretaria', mecanico:'Mecánico' }[rol] || rol;
}

function aplicarPermisosPorRol() {
  const u = getUsuarioActual();
  if (!u) return;
  const rol = u.roles?.nombre;

  // Mecánico solo ve órdenes
  if (rol === 'mecanico') {
    document.querySelectorAll('.nav-item').forEach(n => {
      const page = n.dataset.page;
      if (!['ordenes','dashboard'].includes(page)) {
        n.style.display = 'none';
      }
    });
    navegarA('ordenes');
    return;
  }

  // Secretaria oculta config y reportes avanzados
  if (rol === 'secretaria') {
    document.querySelectorAll('[data-page="config"],[data-page="reportes"]').forEach(n => {
      n.style.display = 'none';
    });
  }
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btnEl    = document.getElementById('btn-login');

  if (!email || !password) { errEl.textContent = 'Completa todos los campos'; return; }

  btnEl.textContent = 'Entrando...';
  btnEl.disabled = true;

  const { user, error } = await loginUsuario(email, password);

  btnEl.textContent = 'Entrar';
  btnEl.disabled = false;

  if (error) { errEl.textContent = error; return; }

  mostrarApp();
  navegarA('dashboard');
  actualizarDashboard();
  registrarAuditoria('LOGIN');
  showToast(`Bienvenido, ${user.nombre}`, 'success');
}

// Enter en login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
    handleLogin();
  }
});
