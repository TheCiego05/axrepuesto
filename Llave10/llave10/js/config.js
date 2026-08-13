// ============================================================
// CONFIG.JS — Configuración del negocio y secuencias NCF/eCF
// ============================================================

const TIPOS_NCF = [
  // e-CF electrónico
  { tipo: 'e31', nombre: 'Crédito Fiscal',      formato: 'eCF',  prefijo: 'E31' },
  { tipo: 'e32', nombre: 'Consumidor Final',     formato: 'eCF',  prefijo: 'E32' },
  { tipo: 'e33', nombre: 'Nota de Débito',       formato: 'eCF',  prefijo: 'E33' },
  { tipo: 'e34', nombre: 'Nota de Crédito',      formato: 'eCF',  prefijo: 'E34' },
  // NCF físico
  { tipo: 'B01', nombre: 'Crédito Fiscal',       formato: 'NCF',  prefijo: 'B01' },
  { tipo: 'B02', nombre: 'Consumidor Final',      formato: 'NCF',  prefijo: 'B02' },
  { tipo: 'B03', nombre: 'Nota de Débito',        formato: 'NCF',  prefijo: 'B03' },
  { tipo: 'B04', nombre: 'Nota de Crédito',       formato: 'NCF',  prefijo: 'B04' },
  { tipo: 'B14', nombre: 'Régimen Especial',      formato: 'NCF',  prefijo: 'B14' },
  { tipo: 'B15', nombre: 'Gubernamental',         formato: 'NCF',  prefijo: 'B15' },
];

async function cargarConfig() {
  // Datos del negocio
  document.getElementById('cfg-nombre').value    = await getConfig('negocio_nombre') || '';
  document.getElementById('cfg-rnc').value       = await getConfig('negocio_rnc') || '';
  document.getElementById('cfg-telefono').value  = await getConfig('negocio_telefono') || '';
  document.getElementById('cfg-direccion').value = await getConfig('negocio_direccion') || '';
  document.getElementById('cfg-itbis').value     = await getConfig('itbis') || '18';

  await cargarSecuencias();
}

async function guardarConfigNegocio() {
  await setConfig('negocio_nombre', document.getElementById('cfg-nombre').value.trim());
  await setConfig('negocio_rnc', document.getElementById('cfg-rnc').value.trim());
  await setConfig('negocio_telefono', document.getElementById('cfg-telefono').value.trim());
  await setConfig('negocio_direccion', document.getElementById('cfg-direccion').value.trim());
  await setConfig('itbis', document.getElementById('cfg-itbis').value.trim());
  showToast('Configuración guardada', 'success');
}

// ---- SECUENCIAS ----
async function cargarSecuencias() {
  const secuencias = await dbGetAll('secuencias');
  const container = document.getElementById('secuencias-lista');

  // Agrupar por formato
  const eCF = secuencias.filter(s => s.formato === 'eCF');
  const NCF = secuencias.filter(s => s.formato === 'NCF');

  let html = '';

  if (eCF.length) {
    html += `<div class="nav-label" style="margin:12px 0 6px">📱 Comprobantes Electrónicos (e-CF)</div>`;
    html += eCF.map(s => renderSecuencia(s)).join('');
  }
  if (NCF.length) {
    html += `<div class="nav-label" style="margin:16px 0 6px">📄 NCF Físicos</div>`;
    html += NCF.map(s => renderSecuencia(s)).join('');
  }

  if (!secuencias.length) {
    html = `<div class="empty-state"><div class="ico">🔢</div><h3>Sin secuencias configuradas</h3><p>Agrega las secuencias que tienes disponibles de la DGII</p></div>`;
  }

  container.innerHTML = html;
}

function renderSecuencia(s) {
  const usados = s.actual - s.desde;
  const total = s.hasta - s.desde + 1;
  const pct = Math.min(100, Math.round((usados / total) * 100));
  const agotada = s.actual > s.hasta;
  const disponibles = Math.max(0, s.hasta - s.actual + 1);

  // Preview del próximo número
  let proxima = '—';
  if (!agotada) {
    if (s.tipo.startsWith('e')) {
      const cod = s.tipo.substring(1);
      proxima = 'E' + cod + String(s.actual).padStart(10, '0');
    } else {
      proxima = s.tipo + String(s.actual).padStart(8, '0');
    }
  }

  return `
  <div class="seq-card" style="${agotada ? 'opacity:0.5' : ''}">
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span class="badge ${s.formato==='eCF' ? 'badge-purple' : 'badge-blue'}">${s.formato}</span>
        <strong style="font-size:0.9rem">${s.nombre}</strong>
        ${agotada ? '<span class="badge badge-red">Agotada</span>' : s.activa ? '<span class="badge badge-green">Activa</span>' : '<span class="badge badge-gray">Inactiva</span>'}
      </div>
      <p class="mono text-xs text-muted">Rango: ${s.tipo}${String(s.desde).padStart(s.formato==='eCF'?10:8,'0')} → ${s.tipo}${String(s.hasta).padStart(s.formato==='eCF'?10:8,'0')}</p>
      <p class="mono text-xs text-muted">Próxima: <strong>${proxima}</strong> • Disponibles: ${disponibles}</p>
      <div class="progress-bar" style="margin-top:6px">
        <div class="progress-fill" style="width:${pct}%;background:${pct>90?'var(--red)':pct>70?'var(--yellow)':'var(--green)'}"></div>
      </div>
      <p class="text-xs text-muted" style="margin-top:2px">${usados} usados de ${total}</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
      <button class="btn btn-xs btn-ghost" onclick="editarSecuencia('${s.tipo}')">✏️ Editar</button>
      <button class="btn btn-xs btn-danger" onclick="eliminarSecuencia('${s.tipo}')">🗑️</button>
    </div>
  </div>`;
}

// ---- MODAL NUEVA SECUENCIA ----
let secuenciaEditTipo = null;

async function abrirModalSecuencia(tipo = null) {
  secuenciaEditTipo = tipo;
  document.getElementById('modal-seq-titulo').textContent = tipo ? 'Editar Secuencia' : 'Nueva Secuencia';
  document.getElementById('form-secuencia').reset();

  // Poblar select de tipos
  const existentes = await dbGetAll('secuencias');
  const existentesTipos = existentes.map(s => s.tipo);
  const sel = document.getElementById('seq-tipo');
  sel.innerHTML = TIPOS_NCF
    .filter(t => !tipo && !existentesTipos.includes(t.tipo) || t.tipo === tipo)
    .map(t => `<option value="${t.tipo}" data-formato="${t.formato}" data-nombre="${t.nombre}">[${t.formato}] ${t.tipo} — ${t.nombre}</option>`)
    .join('');

  if (tipo) {
    sel.disabled = true;
    const sec = await dbGet('secuencias', tipo);
    if (sec) {
      sel.value = tipo;
      document.getElementById('seq-desde').value = sec.desde;
      document.getElementById('seq-hasta').value = sec.hasta;
      document.getElementById('seq-activa').checked = sec.activa !== false;
    }
  } else {
    sel.disabled = false;
  }

  actualizarPreviewSecuencia();
  abrirModal('modal-secuencia');
}

function actualizarPreviewSecuencia() {
  const sel = document.getElementById('seq-tipo');
  const tipo = sel.value;
  const desde = document.getElementById('seq-desde').value;
  if (!tipo || !desde) { document.getElementById('seq-preview').textContent = '—'; return; }
  let preview;
  if (tipo.startsWith('e')) {
    preview = 'E' + tipo.substring(1) + String(desde).padStart(10, '0');
  } else {
    preview = tipo + String(desde).padStart(8, '0');
  }
  document.getElementById('seq-preview').textContent = preview;
}

async function editarSecuencia(tipo) { abrirModalSecuencia(tipo); }

async function guardarSecuencia() {
  const sel = document.getElementById('seq-tipo');
  const tipo = sel.value;
  if (!tipo) { showToast('Selecciona un tipo', 'error'); return; }

  const desde = parseInt(document.getElementById('seq-desde').value);
  const hasta = parseInt(document.getElementById('seq-hasta').value);
  if (!desde || !hasta || desde > hasta) { showToast('Rango inválido', 'error'); return; }

  const tipoInfo = TIPOS_NCF.find(t => t.tipo === tipo);
  const existente = await dbGet('secuencias', tipo);
  const data = {
    tipo,
    nombre: tipoInfo?.nombre || tipo,
    formato: tipoInfo?.formato || 'NCF',
    desde, hasta,
    actual: secuenciaEditTipo ? (existente?.actual || desde) : desde,
    activa: document.getElementById('seq-activa').checked,
  };

  await dbUpdate('secuencias', data);
  cerrarModal('modal-secuencia');
  showToast('Secuencia guardada', 'success');
  cargarSecuencias();
}

async function eliminarSecuencia(tipo) {
  if (!await confirmar('¿Eliminar esta secuencia? Se perderán los datos de rango configurado.')) return;
  await dbDelete('secuencias', tipo);
  showToast('Secuencia eliminada', 'info');
  cargarSecuencias();
}
