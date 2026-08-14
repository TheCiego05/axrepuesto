// ============================================================
// UTILS.JS — Helpers globales: loading, error handling, etc.
// ============================================================

// ---- LOADING STATE en botones ----
function btnLoading(btnEl, texto = 'Guardando...') {
  if (!btnEl) return;
  btnEl.dataset.originalText = btnEl.innerHTML;
  btnEl.disabled = true;
  btnEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px">
    <svg style="width:14px;height:14px;animation:spin 1s linear infinite;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>${texto}</span>`;
}

function btnReset(btnEl) {
  if (!btnEl) return;
  btnEl.disabled = false;
  btnEl.innerHTML = btnEl.dataset.originalText || 'Guardar';
}

// Add spinner CSS
const spinStyle = document.createElement('style');
spinStyle.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
document.head.appendChild(spinStyle);

// ---- WRAPPER ASYNC CON ERROR HANDLING ----
async function withLoading(btnEl, fn, loadingText = 'Procesando...') {
  btnLoading(btnEl, loadingText);
  try {
    await fn();
  } catch(err) {
    console.error(err);
    showToast('Error: ' + (err.message || 'Algo salió mal'), 'error');
  } finally {
    btnReset(btnEl);
  }
}

// ---- SKELETON LOADER ----
function skeletonRows(cols = 5, rows = 4) {
  return Array(rows).fill(0).map(() => `
    <tr>${Array(cols).fill(0).map(() => `
      <td><div style="height:14px;background:linear-gradient(90deg,var(--border) 25%,var(--border2) 50%,var(--border) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:4px;"></div></td>`
    ).join('')}</tr>`).join('');
}

function skeletonCards(count = 3) {
  return Array(count).fill(0).map(() => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:8px">
      <div style="height:16px;width:60%;background:linear-gradient(90deg,var(--border) 25%,var(--border2) 50%,var(--border) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:4px;margin-bottom:8px"></div>
      <div style="height:12px;width:40%;background:linear-gradient(90deg,var(--border) 25%,var(--border2) 50%,var(--border) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:4px"></div>
    </div>`).join('');
}

// Add shimmer CSS
const shimmerStyle = document.createElement('style');
shimmerStyle.textContent = '@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }';
document.head.appendChild(shimmerStyle);

// ---- EMPTY STATE ----
function emptyState(icon, title, desc, btnLabel = null, btnOnclick = null) {
  return `<div class="empty-state">
    <div style="font-size:2.5rem;margin-bottom:12px;opacity:0.3">${icon}</div>
    <h3>${title}</h3>
    <p style="margin-bottom:${btnLabel?'16px':'0'}">${desc}</p>
    ${btnLabel ? `<button class="btn btn-primary" onclick="${btnOnclick}">${btnLabel}</button>` : ''}
  </div>`;
}

// ---- CONFIRM MEJORADO ----
function confirmarAccion(msg, tipo = 'danger') {
  return new Promise(res => {
    // Simple confirm por ahora, mejorar a modal luego
    res(window.confirm(msg));
  });
}

// ---- FORMATTERS ----
function formatDateLong(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-DO', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-DO', {
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit'
  });
}

function formatPhone(phone) {
  if (!phone) return '—';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) return `(${clean.slice(0,3)}) ${clean.slice(3,6)}-${clean.slice(6)}`;
  return phone;
}

// ============================================================
// VALIDACIÓN DE DATOS — Fase E
// ============================================================

const VALIDATORS = {
  cedula:    v => !v || /^\d{3}-\d{7}-\d{1}$/.test(v) || '001-0000000-0',
  rnc:       v => !v || /^\d{3}-\d{5}-\d{1}$/.test(v) || '101-00000-0',
  telefono:  v => !v || /^[\d\s\-\(\)\+]{7,15}$/.test(v),
  email:     v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  placa:     v => !v || /^[A-Z0-9]{5,8}$/.test(v.toUpperCase()),
  positivo:  v => !v || parseFloat(v) >= 0,
  requerido: v => v && v.trim().length > 0,
};

function validarCampo(valor, tipo) {
  const validator = VALIDATORS[tipo];
  if (!validator) return true;
  const result = validator(valor);
  return result === true || result === false ? result : false;
}

function mostrarErrorCampo(inputId, msg) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.style.borderColor = '#ef4444';
  let errEl = el.parentNode.querySelector('.field-error');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.className = 'field-error';
    errEl.style.cssText = 'color:#ef4444;font-size:0.65rem;margin-top:3px';
    el.parentNode.appendChild(errEl);
  }
  errEl.textContent = msg;
  el.addEventListener('input', () => {
    el.style.borderColor = '';
    errEl.textContent = '';
  }, { once: true });
}

function limpiarErroresCampos() {
  document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
  document.querySelectorAll('.form-control').forEach(e => e.style.borderColor = '');
}

// Sanitizar inputs para prevenir XSS
function sanitizar(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#x27;');
}
