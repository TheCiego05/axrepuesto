// ============================================================
// APP.JS — Llave10
// ============================================================
let deferredInstall = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar si hay sesión activa
  const user = getUsuarioActual();
  if (user) { mostrarApp(); await actualizarDashboard(); }
  else { mostrarLogin(); }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredInstall = e;
    document.getElementById('btn-install').classList.add('visible');
  });
});

function navegarA(pagina) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg  = document.getElementById('page-' + pagina);
  const nav = document.querySelector(`[data-page="${pagina}"]`);
  if (pg)  pg.classList.add('active');
  if (nav) nav.classList.add('active');
  switch(pagina) {
    case 'dashboard':  actualizarDashboard(); break;
    case 'clientes':   cargarClientes(); break;
    case 'inventario': cargarInventario(); break;
    case 'ordenes':    cargarOrdenes(); break;
    case 'facturas':   cargarFacturas(); break;
    case 'cobros':     cargarCobros(); break;
    case 'reportes':   cargarReportes(); break;
    case 'config':     cargarConfig(); break;
    case 'usuarios':   cargarUsuarios(); break;
    case 'asistente':  cargarApiKeyIA(); break;
  }
}

async function actualizarDashboard() {
  const [ordenes, repuestos, facturas, cobros] = await Promise.all([
    dbGetAll('ordenes'), dbGetAll('repuestos'),
    dbGetAll('facturas'), dbGetAll('cuentas_cobrar')
  ]);

  const activas   = ordenes.filter(o => !['cerrado','cancelado','descartado'].includes(o.estado_orden));
  const hoy       = new Date().toDateString();
  const facHoy    = facturas.filter(f => new Date(f.creado_en).toDateString() === hoy);
  const totalHoy  = facHoy.reduce((s,f) => s + (f.total||0), 0);
  const stockBajo = repuestos.filter(r => (r.stock||0) <= (r.stock_min||5));
  const porCobrar = cobros.filter(c => c.estado !== 'pagado')
                          .reduce((s,c) => s + (parseFloat(c.monto_pendiente)||0), 0);

  document.getElementById('dash-ordenes').textContent    = activas.length;
  document.getElementById('dash-ingresos').textContent   = formatMoney(totalHoy);
  document.getElementById('dash-por-cobrar').textContent = formatMoney(porCobrar);
  document.getElementById('dash-stock').textContent      = stockBajo.length;

  // Mini kanban en dashboard
  const estadosDash = [
    { key:'borrador',            label:'Borrador', cls:'badge-gray' },
    { key:'en_diagnostico',      label:'Diagnóstico', cls:'badge-blue' },
    { key:'pendiente_aprobacion',label:'Por Aprobar', cls:'badge-yellow' },
    { key:'en_progreso',         label:'En Progreso', cls:'badge-yellow' },
    { key:'pendiente_pago',      label:'Por Pagar', cls:'badge-purple' },
  ];
  const kanban = document.getElementById('dash-kanban');
  kanban.innerHTML = estadosDash.map(e => {
    const cnt = ordenes.filter(o => o.estado_orden === e.key).length;
    return `<div style="background:var(--bg3);border-radius:8px;padding:10px 14px;min-width:100px;text-align:center">
      <div class="text-xs text-muted">${e.label}</div>
      <div style="font-size:1.4rem;font-weight:700;margin-top:4px">${cnt}</div>
    </div>`;
  }).join('');

  // Tabla recientes
  const recientes = ordenes.sort((a,b) => new Date(b.creado_en)-new Date(a.creado_en)).slice(0,5);
  const tbody = document.getElementById('dash-ordenes-list');
  if (!recientes.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text2)">Sin órdenes</td></tr>';
    return;
  }
  tbody.innerHTML = recientes.map(o => `
    <tr>
      <td class="mono text-xs">#${String(o.id).padStart(4,'0')}</td>
      <td>${o.cliente_nombre||'—'}</td>
      <td class="mono text-xs">${o.vehiculo_placa||'—'}</td>
      <td>${badgeEstadoOrden(o.estado_orden)}</td>
      <td><span class="prioridad-${o.prioridad||'normal'}">${iconPrioridad(o.prioridad)}</span></td>
      <td><button class="btn btn-xs btn-ghost" onclick="navegarA('ordenes')">Ver</button></td>
    </tr>`).join('');
}

// Estados de ORDEN (nivel macro)
function badgeEstadoOrden(estado) {
  const map = {
    borrador:             '<span class="badge badge-gray">📋 Borrador</span>',
    en_diagnostico:       '<span class="badge badge-blue">🔍 Diagnóstico</span>',
    pendiente_aprobacion: '<span class="badge badge-yellow">⏳ Por Aprobar</span>',
    en_progreso:          '<span class="badge badge-yellow">🔧 En Progreso</span>',
    pendiente_pago:       '<span class="badge badge-purple">💳 Por Pagar</span>',
    cerrado:              '<span class="badge badge-green">✅ Cerrado</span>',
    cancelado:            '<span class="badge badge-red">❌ Cancelado</span>',
    descartado:           '<span class="badge badge-gray">🗑️ Descartado</span>',
  };
  return map[estado] || `<span class="badge badge-gray">${estado||'—'}</span>`;
}

// Estados de ARREGLO (nivel micro — dentro de la orden)
function badgeEstado(estado) {
  const map = {
    en_proceso: '<span class="badge badge-yellow">🔧 En Proceso</span>',
    prueba:     '<span class="badge badge-blue">🔵 En Prueba</span>',
    listo:      '<span class="badge badge-green">✅ Listo</span>',
    completada: '<span class="badge badge-gray">📋 Completada</span>',
  };
  return map[estado] || `<span class="badge badge-gray">${estado||'—'}</span>`;
}

function iconPrioridad(p) {
  return { alta:'🔴 Alta', media:'🟡 Media', normal:'⚪ Normal' }[p] || '⚪ Normal';
}

// Vista Kanban de órdenes
let vistaOrdenesActual = 'lista';
function toggleVistaOrdenes(vista) {
  vistaOrdenesActual = vista;
  document.getElementById('ordenes-lista').style.display   = vista==='lista'   ? 'block' : 'none';
  document.getElementById('ordenes-kanban').style.display  = vista==='kanban'  ? 'block' : 'none';
  if (vista === 'kanban') renderKanban();
}

async function renderKanban() {
  const ordenes = await dbGetAll('ordenes');
  const cols = [
    { key:'borrador',            label:'📋 Borrador',        cls:'badge-gray' },
    { key:'en_diagnostico',      label:'🔍 Diagnóstico',     cls:'badge-blue' },
    { key:'pendiente_aprobacion',label:'⏳ Por Aprobar',     cls:'badge-yellow' },
    { key:'en_progreso',         label:'🔧 En Progreso',     cls:'badge-yellow' },
    { key:'pendiente_pago',      label:'💳 Por Pagar',       cls:'badge-purple' },
    { key:'cerrado',             label:'✅ Cerrado',          cls:'badge-green' },
  ];
  const board = document.getElementById('kanban-board');
  board.innerHTML = cols.map(col => {
    const cards = ordenes.filter(o => o.estado_orden === col.key);
    return `
    <div class="kanban-col">
      <div class="kanban-col-header">
        <h4>${col.label}</h4>
        <span class="badge ${col.cls}">${cards.length}</span>
      </div>
      <div class="kanban-col-body">
        ${cards.length ? cards.map(o => `
          <div class="kanban-card" onclick="abrirDetalleOrden(${o.id})">
            <h5>${o.vehiculo_marca||''} ${o.vehiculo_modelo||''}</h5>
            <p>👤 ${o.cliente_nombre||'—'}<br>🚗 ${o.vehiculo_placa||'—'}</p>
            <div class="kc-meta">
              <span class="text-xs text-muted">${formatDate(o.creado_en)}</span>
              <span class="text-xs prioridad-${o.prioridad}">${iconPrioridad(o.prioridad)}</span>
            </div>
          </div>`).join('') : '<p class="text-xs text-muted" style="padding:8px">Sin órdenes</p>'}
      </div>
    </div>`;
  }).join('');
}

async function instalarApp() {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  const r = await deferredInstall.userChoice;
  if (r.outcome === 'accepted') {
    document.getElementById('btn-install').classList.remove('visible');
    deferredInstall = null;
    showToast('App instalada', 'success');
  }
}

function showToast(msg, tipo = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.innerHTML = `<span>${{success:'✅',error:'❌',info:'ℹ️'}[tipo]||'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function abrirModal(id)  { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }
function confirmar(msg)  { return Promise.resolve(window.confirm(msg)); }
function formatMoney(n)  { return 'RD$ ' + (n||0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function formatDate(iso) { if (!iso) return '—'; return new Date(iso).toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'}); }

function cargarApiKeyIA() {
  const key = localStorage.getItem('llave10_ia_key') || '';
  const el = document.getElementById('ia-api-key');
  if (el) el.value = key ? '••••••••' : '';
}
function guardarApiKeyIA() {
  const val = document.getElementById('ia-api-key').value.trim();
  if (val && val !== '••••••••') localStorage.setItem('llave10_ia_key', val);
  showToast('API Key guardada', 'success');
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
