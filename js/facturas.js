
async function cargarMetodosPago(selectId = 'fac-metodo-pago') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  try {
    const metodos = await dbGetAll('metodos_pago');
    const activos = metodos.filter(m => m.activo).sort((a,b) => a.orden - b.orden);
    if (activos.length) {
      sel.innerHTML = activos.map(m =>
        `<option value="${m.nombre.toLowerCase()}">${m.icono} ${m.nombre}</option>`
      ).join('');
    }
  } catch(e) {
    // Fallback default options
    sel.innerHTML = `
      <option value="efectivo">💵 Efectivo</option>
      <option value="tarjeta_debito">💳 Tarjeta Débito</option>
      <option value="tarjeta_credito">💳 Tarjeta Crédito</option>
      <option value="transferencia">🏦 Transferencia</option>
      <option value="cheque">📋 Cheque</option>
      <option value="pago_movil">📱 Pago Móvil</option>`;
  }
}
// ============================================================
// FACTURAS.JS — Facturación con NCF / e-CF
// ============================================================
let facturaActual = null;

async function cargarFacturas(busqueda = '') {
  const todas = await dbGetAll('facturas');
  let filtradas = todas;
  if (busqueda) {
    const q = busqueda.toLowerCase();
    filtradas = filtradas.filter(f =>
      f.numero?.toLowerCase().includes(q) ||
      f.cliente_nombre?.toLowerCase().includes(q) ||
      f.ncf?.toLowerCase().includes(q)
    );
  }
  filtradas.sort((a,b) => new Date(b.creadoEn) - new Date(a.creadoEn));

  const tbody = document.getElementById('facturas-tbody');
  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="ico">🧾</div><h3>Sin facturas</h3><p>Las facturas aparecerán aquí al completar órdenes</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = filtradas.map(f => `
    <tr>
      <td class="mono text-sm">${f.numero}</td>
      <td>${formatDate(f.creadoEn)}</td>
      <td>${f.cliente_nombre}</td>
      <td class="mono text-xs">${f.ncf ? `<span class="badge badge-purple">${f.ncf}</span>` : '<span class="badge badge-gray">Sin NCF</span>'}</td>
      <td>${f.ncf ? (f.tipo_ncf || '—') : '—'}</td>
      <td class="mono">${formatMoney(f.total)}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-xs btn-primary" onclick="verFactura(${f.id})">👁️ Ver</button>
          <button class="btn btn-xs btn-ghost" onclick="imprimirFactura(${f.id})">🖨️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ---- CREAR FACTURA DESDE ORDEN ----
async function facturarOrden(ordenId) {
  const orden = await dbGet('ordenes', ordenId);
  if (!orden) return;
  const cliente = await dbGet('clientes', orden.cliente_id);
  const vehiculo = await dbGet('vehiculos', orden.vehiculo_id);

  // Calcular totales
  const arreglos = orden.arreglos || [];
  let subtotal = 0;
  arreglos.forEach(a => {
    subtotal += (a.manoObra || 0);
    (a.repuestos || []).forEach(r => { subtotal += (r.precio || 0) * (r.cantidad || 1); });
  });

  const itbisPct = parseFloat(await getConfig('itbis') || '18') / 100;
  const itbis = subtotal * itbisPct;
  const total = subtotal + itbis;

  facturaActual = { orden, cliente, vehiculo, arreglos, subtotal, itbis, itbisPct, total };

  // Poblar modal
  document.getElementById('fac-cliente-nombre').value = cliente?.nombre || '';
  document.getElementById('fac-cliente-cedula').value = cliente?.cedula || '';
  document.getElementById('fac-cliente-rnc').value = cliente?.rnc || '';
  document.getElementById('fac-subtotal').textContent = formatMoney(subtotal);
  document.getElementById('fac-itbis').textContent = formatMoney(itbis);
  document.getElementById('fac-total').textContent = formatMoney(total);

  // Secuencias disponibles
  await poblarSecuencias();
  document.getElementById('fac-ncf-tipo').value = '';
  document.getElementById('fac-ncf-preview').textContent = '—';
  document.getElementById('fac-metodo-pago').value = 'efectivo';
  document.getElementById('fac-usar-ncf').checked = false;
  toggleNcfSection();
  await cargarMetodosPago('fac-metodo-pago');

  abrirModal('modal-facturar');
}

async function poblarSecuencias() {
  const secuencias = await dbGetAll('secuencias');
  const activas = secuencias.filter(s => s.activa && s.actual <= s.hasta);
  const sel = document.getElementById('fac-ncf-tipo');
  sel.innerHTML = '<option value="">— Seleccione tipo de comprobante —</option>' +
    activas.map(s => `<option value="${s.tipo}">[${s.formato}] ${s.nombre}</option>`).join('');
}

function toggleNcfSection() {
  const usar = document.getElementById('fac-usar-ncf').checked;
  document.getElementById('seccion-ncf').style.display = usar ? 'block' : 'none';
}

async function previsualizarNcf() {
  const tipo = document.getElementById('fac-ncf-tipo').value;
  if (!tipo) { document.getElementById('fac-ncf-preview').textContent = '—'; return; }
  const sec = await getSecuencia(tipo);
  if (!sec) return;
  let preview;
  if (tipo.startsWith('e')) {
    const cod = tipo.substring(1);
    preview = 'E' + cod + String(sec.actual).padStart(10, '0');
  } else {
    preview = tipo + String(sec.actual).padStart(8, '0');
  }
  document.getElementById('fac-ncf-preview').textContent = preview;
}

async function confirmarFactura() {
  if (!facturaActual) return;

  let ncf = null;
  let tipoNcf = null;
  let formatoNcf = null;

  const usarNcf = document.getElementById('fac-usar-ncf').checked;
  if (usarNcf) {
    const tipoSel = document.getElementById('fac-ncf-tipo').value;
    if (!tipoSel) { showToast('Selecciona un tipo de comprobante', 'error'); return; }
    const sec = await getSecuencia(tipoSel);
    if (!sec || sec.actual > sec.hasta) { showToast('Secuencia agotada', 'error'); return; }
    ncf = await getSiguienteNCF(tipoSel);
    tipoNcf = sec.nombre;
    formatoNcf = sec.formato;
  }

  const numero = await generarNumeroFactura();
  const config = {
    nombre: await getConfig('negocio_nombre'),
    rnc: await getConfig('negocio_rnc'),
    telefono: await getConfig('negocio_telefono'),
    direccion: await getConfig('negocio_direccion'),
  };

  const factura = {
    numero,
    orden_id: facturaActual.orden.id,
    cliente_id: facturaActual.cliente?.id,
    cliente_nombre: document.getElementById('fac-cliente-nombre').value,
    cliente_cedula: document.getElementById('fac-cliente-cedula').value,
    cliente_rnc: document.getElementById('fac-cliente-rnc').value,
    vehiculo_placa: facturaActual.vehiculo?.placa,
    vehiculo_desc: `${facturaActual.vehiculo?.marca||''} ${facturaActual.vehiculo?.modelo||''} ${facturaActual.vehiculo?.anio||''}`,
    arreglos: facturaActual.arreglos,
    subtotal: facturaActual.subtotal,
    itbis: facturaActual.itbis,
    itbis_pct: facturaActual.itbisPct * 100,
    total: facturaActual.total,
    ncf, tipoNcf, formatoNcf,
    metodo_pago: document.getElementById('fac-metodo-pago').value,
    negocio: config,
  };

  const facturaId = await dbAdd('facturas', factura);

  // Marcar orden como completada
  const orden = facturaActual.orden;
  await dbUpdate('ordenes', { ...orden, estado: 'completada', facturaId });

  cerrarModal('modal-facturar');
  showToast('Factura generada: ' + numero, 'success');
  cargarFacturas();
  actualizarDashboard();

  // Mostrar factura
  setTimeout(() => verFactura(facturaId), 300);
}

// ---- VER / IMPRIMIR FACTURA ----
async function verFactura(id) {
  const f = await dbGet('facturas', id);
  if (!f) return;
  document.getElementById('factura-html').innerHTML = generarHTMLFactura(f);
  abrirModal('modal-ver-factura');
}

async function imprimirFactura(id) {
  const f = await dbGet('facturas', id);
  if (!f) return;
  const html = generarHTMLFactura(f);
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Factura ${f.numero}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
      body { margin: 0; padding: 20px; font-family: Inter, sans-serif; }
      @media print { body { padding: 0; } .no-print { display: none; } }
      ${getFacturaPrintCSS()}
    </style>
  </head><body>${html}
  <div class="no-print" style="text-align:center;margin-top:20px">
    <button onclick="window.print()" style="padding:10px 24px;background:#f59e0b;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:1rem">🖨️ Imprimir</button>
  </div>
  </body></html>`);
  win.document.close();
}

function generarHTMLFactura(f) {
  const config = f.negocio || {};
  const arreglos = f.arreglos || [];
  let filas = '';
  let num = 1;
  arreglos.forEach(a => {
    filas += `<tr><td>${num++}</td><td>Mano de Obra: ${a.descripcion}</td><td>1</td><td class="text-right">${moneyHTML(a.manoObra)}</td><td class="text-right">${moneyHTML(a.manoObra)}</td></tr>`;
    (a.repuestos||[]).forEach(r => {
      const tot = r.precio * r.cantidad;
      filas += `<tr><td>${num++}</td><td>Repuesto: ${r.nombre}</td><td>${r.cantidad}</td><td class="text-right">${moneyHTML(r.precio)}</td><td class="text-right">${moneyHTML(tot)}</td></tr>`;
    });
  });

  const ncfBox = f.ncf ? `
    <div class="fac-ncf-box">
      <strong>Comprobante Fiscal ${f.formato_ncf === 'eCF' ? 'Electrónico (e-CF)' : 'NCF'}</strong><br>
      Tipo: ${f.tipo_ncf} &nbsp;|&nbsp; NCF: <strong style="font-family:monospace">${f.ncf}</strong>
    </div>` : '';

  return `
  <div class="factura-preview">
    <div class="fac-header">
      <div class="fac-logo">
        <h2>🔧 ${config.nombre || 'AXRepuesto'}</h2>
        <p>${config.rnc ? 'RNC: ' + config.rnc : ''}</p>
        <p>${config.telefono || ''}</p>
        <p>${config.direccion || ''}</p>
      </div>
      <div class="fac-num">
        <h3>Factura</h3>
        <div class="num">#${f.numero}</div>
        ${f.ncf ? `<div class="ncf">${f.ncf}</div>` : ''}
        <p style="font-size:0.75rem;color:#666;margin-top:4px">${formatDate(f.creadoEn)}</p>
      </div>
    </div>

    ${ncfBox}

    <div class="fac-parties">
      <div class="fac-party">
        <h4>Facturado A</h4>
        <p><strong>${f.cliente_nombre || '—'}</strong></p>
        ${f.cliente_cedula ? `<p>Cédula: ${f.cliente_cedula}</p>` : ''}
        ${f.cliente_rnc ? `<p>RNC: ${f.cliente_rnc}</p>` : ''}
      </div>
      <div class="fac-party">
        <h4>Vehículo</h4>
        <p><strong>${f.vehiculo_desc || '—'}</strong></p>
        ${f.vehiculo_placa ? `<p>Placa: <strong style="font-family:monospace">${f.vehiculo_placa}</strong></p>` : ''}
      </div>
    </div>

    <table class="fac-table">
      <thead><tr><th>#</th><th>Descripción</th><th>Cant.</th><th class="text-right">Precio</th><th class="text-right">Total</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end">
      <div class="fac-totals">
        <div class="row"><span>Subtotal</span><span>${moneyHTML(f.subtotal)}</span></div>
        <div class="row"><span>ITBIS (${f.itbis_pct||18}%)</span><span>${moneyHTML(f.itbis)}</span></div>
        <div class="row total"><span>TOTAL</span><span>${moneyHTML(f.total)}</span></div>
      </div>
    </div>

    <div style="margin-top:16px;font-size:0.8rem;color:#555">
      <strong>Método de Pago:</strong> ${f.metodo_pago || 'Efectivo'}
    </div>

    <div class="fac-footer">
      <p>¡Gracias por su preferencia! • ${config.nombre || ''} • ${config.telefono || ''}</p>
      ${f.ncf ? `<p style="margin-top:4px;font-size:0.7rem">Este documento es un comprobante fiscal válido según las regulaciones de la DGII.</p>` : ''}
    </div>
  </div>`;
}

function moneyHTML(n) {
  return 'RD$ ' + (n||0).toLocaleString('es-DO', {minimumFractionDigits:2,maximumFractionDigits:2});
}

function getFacturaPrintCSS() {
  return `.factura-preview{max-width:700px;margin:0 auto;font-family:Inter,sans-serif;color:#1a1a1a}
  .fac-header{display:flex;justify-content:space-between;margin-bottom:24px}
  .fac-logo h2{font-size:1.3rem;font-weight:800}.fac-logo p{font-size:0.75rem;color:#666}
  .fac-num{text-align:right}.fac-num .num{font-size:1.2rem;font-weight:800}
  .fac-num .ncf{font-size:0.85rem;font-weight:700;color:#d97706;font-family:monospace}
  .fac-parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
  .fac-party h4{font-size:0.7rem;font-weight:700;color:#999;text-transform:uppercase;margin-bottom:6px}
  .fac-party p{font-size:0.82rem;line-height:1.6}
  .fac-table{width:100%;border-collapse:collapse;margin-bottom:20px}
  .fac-table th{background:#1a1a1a;color:#fff;padding:8px 10px;font-size:0.72rem;text-align:left}
  .fac-table td{padding:8px 10px;font-size:0.8rem;border-bottom:1px solid #eee}
  .fac-totals{width:240px}.fac-totals .row{display:flex;justify-content:space-between;padding:4px 0;font-size:0.83rem}
  .fac-totals .row.total{font-weight:800;font-size:1rem;border-top:2px solid #1a1a1a;margin-top:4px;padding-top:8px}
  .fac-footer{margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:0.72rem;color:#999;text-align:center}
  .fac-ncf-box{background:#fff8e1;border:1px solid #f59e0b;border-radius:6px;padding:8px 12px;margin-bottom:16px;font-size:0.78rem}
  .text-right{text-align:right}`;
}
