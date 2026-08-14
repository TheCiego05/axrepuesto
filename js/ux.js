// ============================================================
// UX.JS — Mejoras de experiencia de usuario Fase B
// ============================================================

// ---- B4: DEBOUNCE para búsquedas ----
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Aplicar debounce a todos los campos de búsqueda al cargar
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.querySelectorAll('.search-input').forEach(input => {
      const originalHandler = input.getAttribute('oninput');
      if (!originalHandler) return;
      input.removeAttribute('oninput');
      input.addEventListener('input', debounce((e) => {
        eval(originalHandler.replace('this.value', `'${e.target.value}'`));
      }, 350));
    });
  }, 1000);
});

// ---- B2: TOAST MEJORADO con progreso ----
function showToastPro(msg, tipo = 'info', duracion = 3500) {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  t.innerHTML = `
    <span style="flex-shrink:0">${icons[tipo]||'ℹ️'}</span>
    <span style="flex:1">${msg}</span>
    <div style="position:absolute;bottom:0;left:0;height:2px;background:currentColor;opacity:0.3;animation:toastBar ${duracion}ms linear forwards;border-radius:0 0 8px 8px"></div>`;
  t.style.position = 'relative';
  t.style.overflow = 'hidden';
  container.appendChild(t);
  setTimeout(() => t.remove(), duracion);
}

// Override showToast global
window.showToast = showToastPro;

// ---- B3: ESTADOS VACÍOS mejorados ----
// (ya en utils.js, aquí extendemos)

// ---- B6: PANEL LATERAL para órdenes ----
let panelOrdenId = null;

async function abrirPanelOrden(ordenId) {
  panelOrdenId = ordenId;
  const orden = await dbGet('ordenes', ordenId);
  if (!orden) return;

  const panel = document.getElementById('panel-orden');
  if (!panel) return;

  const arreglos = orden.arreglos || [];
  const totalMO = arreglos.reduce((s,a) => s + (a.manoObra || a.mano_obra || 0), 0);

  panel.innerHTML = `
    <div style="padding:18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div>
        <h3 style="font-size:0.95rem;font-weight:700">${orden.vehiculo_marca||''} ${orden.vehiculo_modelo||''}</h3>
        <p style="font-size:0.72rem;color:var(--text2)">${orden.cliente_nombre||'—'} · ${orden.vehiculo_placa||'—'}</p>
      </div>
      <button onclick="cerrarPanelOrden()" style="background:none;border:none;color:var(--text2);font-size:1.2rem;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;overflow-y:auto;flex:1">
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        ${badgeEstadoOrden(orden.estado_orden)}
        <span class="badge badge-${orden.prioridad==='alta'?'red':orden.prioridad==='media'?'yellow':'gray'}">${iconPrioridad(orden.prioridad)}</span>
      </div>
      ${orden.sintomas ? `<div style="background:var(--bg3);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:0.78rem"><strong style="font-size:0.65rem;color:var(--text2);display:block;margin-bottom:4px">SÍNTOMAS</strong>${orden.sintomas}</div>` : ''}
      <div style="margin-bottom:14px">
        <strong style="font-size:0.65rem;color:var(--text2);display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Arreglos (${arreglos.length})</strong>
        ${arreglos.map((a,i) => `
          <div style="background:var(--bg3);border-radius:7px;padding:10px;margin-bottom:6px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-size:0.8rem;font-weight:600">${a.descripcion}</span>
              <span style="font-size:0.72rem;color:var(--text2)">${formatMoney(a.manoObra||a.mano_obra||0)}</span>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              ${['en_proceso','prueba','listo'].map(est => `
                <button onclick="cambiarEstadoArregloPanel(${orden.id},${i},'${est}')"
                  class="estado-btn ${a.estado===est?'badge badge-'+(est==='listo'?'green':est==='prueba'?'blue':'yellow'):'badge badge-gray'}"
                  style="font-size:0.62rem">
                  ${est==='en_proceso'?'🔧 En Proceso':est==='prueba'?'🔵 Prueba':'✅ Listo'}
                </button>`).join('')}
            </div>
          </div>`).join('')}
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px">
          <span class="text-muted">Mano de obra total</span>
          <span class="mono">${formatMoney(totalMO)}</span>
        </div>
        <div style="font-size:0.65rem;color:var(--text2)">+ repuestos al facturar</div>
      </div>
      <div style="display:flex;gap:8px;flex-direction:column">
        <select class="form-control" onchange="cambiarEstadoOrden(${orden.id},this.value)" style="font-size:0.78rem">
          ${['recibido','en_taller','listo','entregado'].map(e => `
            <option value="${e}" ${orden.estado_orden===e?'selected':''}>${
              e==='recibido'?'🔵 Recibido':e==='en_taller'?'🔧 En Taller':e==='listo'?'✅ Listo':'🚗 Entregado'
            }</option>`).join('')}
        </select>
        ${orden.estado_orden === 'listo' ? `<button class="btn btn-primary" onclick="cerrarPanelOrden();facturarOrden(${orden.id})">🧾 Facturar</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="cerrarPanelOrden();editarOrden(${orden.id})">✏️ Editar orden</button>
      </div>
    </div>`;

  panel.style.transform = 'translateX(0)';
  document.getElementById('panel-overlay').style.display = 'block';
}

async function cambiarEstadoArregloPanel(ordenId, idx, nuevoEstado) {
  const orden = await dbGet('ordenes', ordenId);
  orden.arreglos[idx].estado = nuevoEstado;
  const todos = orden.arreglos.every(a => a.estado === 'listo');
  if (todos && orden.estado_orden === 'en_taller') orden.estado_orden = 'listo';
  await dbUpdate('ordenes', orden);
  abrirPanelOrden(ordenId);
  cargarOrdenes();
  showToast('Estado actualizado', 'success');
}

function cerrarPanelOrden() {
  const panel = document.getElementById('panel-orden');
  if (panel) panel.style.transform = 'translateX(100%)';
  const overlay = document.getElementById('panel-overlay');
  if (overlay) overlay.style.display = 'none';
  panelOrdenId = null;
}

// ---- B9: NOTIFICACIONES cuando orden está lista ----
async function verificarOrdenesListas() {
  const ordenes = await dbGetAll('ordenes');
  const listas = ordenes.filter(o => o.estado_orden === 'listo');
  if (listas.length > 0) {
    const badge = document.getElementById('nav-badge-ordenes');
    if (badge) {
      badge.textContent = listas.length;
      badge.style.display = 'inline';
    }
  }
}

// ---- B7: CONTADOR DE CARACTERES ----
function initCharCounters() {
  document.querySelectorAll('textarea.form-control').forEach(ta => {
    const maxLen = ta.getAttribute('maxlength') || 500;
    const counter = document.createElement('div');
    counter.style.cssText = 'font-size:0.62rem;color:var(--text2);text-align:right;margin-top:2px';
    counter.textContent = `0 / ${maxLen}`;
    ta.parentNode.appendChild(counter);
    ta.addEventListener('input', () => {
      counter.textContent = `${ta.value.length} / ${maxLen}`;
      counter.style.color = ta.value.length > maxLen * 0.9 ? 'var(--red)' : 'var(--text2)';
    });
  });
}

// ---- B8: AUTOCOMPLETAR placa al seleccionar vehículo ----
async function autocompletarVehiculo(vehiculoId, prefijo = 'ord') {
  if (!vehiculoId) return;
  try {
    const v = await dbGet('vehiculos', parseInt(vehiculoId));
    if (!v) return;
    // Si hay campos de placa/vehiculo en el formulario activo, llenarlos
    const placaEl = document.getElementById(`${prefijo}-placa`);
    if (placaEl) placaEl.value = v.placa || '';
  } catch(e) {}
}

// Inicializar UX improvements
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initCharCounters();
    verificarOrdenesListas();
    // Verificar cada 2 minutos
    setInterval(verificarOrdenesListas, 120000);
  }, 1500);
});

// ---- B5: WIZARD para modal de turno ----
let wizardStep = 1;
const WIZARD_TOTAL = 3;

function wizardGoTo(step) {
  wizardStep = step;
  for (let i = 1; i <= WIZARD_TOTAL; i++) {
    const pane  = document.getElementById(`wpane-${i}`);
    const sStep = document.getElementById(`wstep-${i}`);
    if (!pane || !sStep) continue;
    pane.classList.toggle('active', i === step);
    sStep.classList.remove('active','done');
    if (i === step) sStep.classList.add('active');
    else if (i < step) sStep.classList.add('done');
  }
  // Botones
  const prev = document.getElementById('turno-btn-prev');
  const next = document.getElementById('turno-btn-next');
  const save = document.getElementById('turno-btn-save');
  if (prev) prev.style.display = step > 1 ? 'inline-flex' : 'none';
  if (next) next.style.display = step < WIZARD_TOTAL ? 'inline-flex' : 'none';
  if (save) save.style.display = step === WIZARD_TOTAL ? 'inline-flex' : 'none';
}

function wizardNext() {
  // Validar paso 1
  if (wizardStep === 1) {
    const fecha = document.getElementById('turno-fecha')?.value;
    const hora  = document.getElementById('turno-hora')?.value;
    if (!fecha || !hora) { showToast('Fecha y hora son requeridas', 'error'); return; }
  }
  if (wizardStep < WIZARD_TOTAL) wizardGoTo(wizardStep + 1);
}

function wizardPrev() {
  if (wizardStep > 1) wizardGoTo(wizardStep - 1);
}

// Reset wizard when opening modal
const _origAbrirModalTurno = window.abrirModalTurno;
document.addEventListener('DOMContentLoaded', () => {
  const origFn = window.abrirModalTurno;
  if (origFn) {
    window.abrirModalTurno = async function(id = null) {
      wizardGoTo(1);
      await origFn(id);
    };
  }
});
