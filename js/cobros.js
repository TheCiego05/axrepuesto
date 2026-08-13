// ============================================================
// COBROS.JS — Cuentas por Cobrar
// ============================================================

async function cargarCobros(busqueda = '') {
  const todas = await dbGetAll('cuentas_cobrar');
  let filtradas = todas.filter(c => c.estado !== 'pagado');
  if (busqueda) {
    const q = busqueda.toLowerCase();
    filtradas = filtradas.filter(c => c.cliente_nombre?.toLowerCase().includes(q));
  }

  const container = document.getElementById('cobros-lista');
  if (!filtradas.length) {
    container.innerHTML = `<div class="empty-state"><div class="ico">💰</div><h3>Sin cuentas pendientes</h3><p>Todas las facturas están saldadas</p></div>`;
    return;
  }

  let totalPendiente = 0;
  filtradas.forEach(c => { totalPendiente += parseFloat(c.monto_pendiente || 0); });
  document.getElementById('cobros-total-pendiente').textContent = formatMoney(totalPendiente);

  container.innerHTML = filtradas.map(c => {
    const pct = c.monto_total > 0 ? Math.round((c.monto_pagado / c.monto_total) * 100) : 0;
    const vencida = c.fecha_vencimiento && new Date(c.fecha_vencimiento) < new Date();
    return `
    <div class="cobro-card">
      <div class="cobro-info">
        <h4>${c.cliente_nombre} ${vencida ? '<span class="badge badge-red">⚠️ Vencida</span>' : ''}</h4>
        <p>Factura asociada • ${formatDate(c.creado_en)}${c.fecha_vencimiento ? ' • Vence: ' + formatDate(c.fecha_vencimiento) : ''}</p>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <div class="progress-cobro" style="flex:1;max-width:160px">
            <div class="progress-cobro-fill" style="width:${pct}%"></div>
          </div>
          <span class="text-xs text-muted">${pct}% pagado</span>
        </div>
      </div>
      <div class="cobro-montos">
        <div class="total">${formatMoney(c.monto_total)}</div>
        <div class="pendiente">Pendiente: ${formatMoney(c.monto_pendiente)}</div>
        ${c.monto_pagado > 0 ? `<div class="pagado">Pagado: ${formatMoney(c.monto_pagado)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        <button class="btn btn-sm btn-primary" onclick="abrirModalPago(${c.id})">💵 Registrar Pago</button>
        <button class="btn btn-sm btn-ghost" onclick="verHistorialPagos(${c.id})">📋 Historial</button>
      </div>
    </div>`;
  }).join('');
}

let cuentaCobraId = null;
async function abrirModalPago(cuentaId) {
  cuentaCobraId = cuentaId;
  const cuenta = await dbGet('cuentas_cobrar', cuentaId);
  document.getElementById('pago-cliente').textContent = cuenta.cliente_nombre;
  document.getElementById('pago-pendiente').textContent = formatMoney(cuenta.monto_pendiente);
  document.getElementById('pago-monto').value = cuenta.monto_pendiente;
  document.getElementById('pago-metodo').value = 'efectivo';
  document.getElementById('pago-referencia').value = '';
  abrirModal('modal-pago');
}

async function guardarPago() {
  const cuenta = await dbGet('cuentas_cobrar', cuentaCobraId);
  const monto = parseFloat(document.getElementById('pago-monto').value) || 0;
  if (monto <= 0) { showToast('Monto inválido', 'error'); return; }
  if (monto > cuenta.monto_pendiente) { showToast('El monto excede el pendiente', 'error'); return; }

  const u = getUsuarioActual();
  await dbAdd('pagos', {
    cuenta_cobrar_id: cuentaCobraId,
    factura_id: cuenta.factura_id,
    monto,
    metodo_pago: document.getElementById('pago-metodo').value,
    referencia: document.getElementById('pago-referencia').value.trim(),
    usuario_id: u?.id,
  });

  const nuevoPagado = (parseFloat(cuenta.monto_pagado) || 0) + monto;
  const nuevoEstado = nuevoPagado >= cuenta.monto_total ? 'pagado' : 'parcial';
  await dbUpdate('cuentas_cobrar', {
    id: cuentaCobraId,
    monto_pagado: nuevoPagado,
    estado: nuevoEstado,
  });

  cerrarModal('modal-pago');
  showToast('Pago registrado correctamente', 'success');
  cargarCobros();
  actualizarDashboard();
}

async function verHistorialPagos(cuentaId) {
  const pagos = await dbGetByIndex('pagos', 'cuenta_cobrar_id', cuentaId);
  const cuenta = await dbGet('cuentas_cobrar', cuentaId);
  let html = `<h4 style="margin-bottom:12px">Pagos de ${cuenta.cliente_nombre}</h4>`;
  if (!pagos.length) {
    html += `<p class="text-muted text-sm">Sin pagos registrados</p>`;
  } else {
    html += pagos.map(p => `
      <div class="arreglo-item">
        <div class="arreglo-desc">
          <strong>${formatMoney(p.monto)}</strong>
          <span>${p.metodo_pago} • ${formatDate(p.creado_en)}${p.referencia ? ' • Ref: ' + p.referencia : ''}</span>
        </div>
      </div>`).join('');
  }
  document.getElementById('historial-pagos-content').innerHTML = html;
  abrirModal('modal-historial-pagos');
}

async function crearCuentaCobrar(facturaId, clienteId, clienteNombre, total) {
  await dbAdd('cuentas_cobrar', {
    factura_id: facturaId,
    cliente_id: clienteId,
    cliente_nombre: clienteNombre,
    monto_total: total,
    monto_pagado: 0,
    estado: 'pendiente',
  });
}
