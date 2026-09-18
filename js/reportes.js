// ============================================================
// REPORTES.JS — Dashboard gerencial y reportes
// ============================================================

async function cargarReportes() {
  renderReporteCards();
}

function renderReporteCards() {
  // Las tarjetas ya están en el HTML, solo actualizamos datos
  generarResumenPeriodo();
}

async function generarResumenPeriodo(periodo = '30') {
  const dias = parseInt(periodo);
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);

  const [facturas, ordenes, clientes, cobros, comisiones, mecanicos] = await Promise.all([
    dbGetAll('facturas'), dbGetAll('ordenes'),
    dbGetAll('clientes'), dbGetAll('cuentas_cobrar'),
    dbGetAll('comisiones_mecanicos'), dbGetAll('mecanicos'),
  ]);

  const facPeriodo = facturas.filter(f => new Date(f.creado_en) >= desde);
  const ordPeriodo = ordenes.filter(o => new Date(o.creado_en) >= desde);

  const totalVentas    = facPeriodo.reduce((s,f) => s + (f.total||0), 0);
  const totalItbis     = facPeriodo.reduce((s,f) => s + (f.itbis||0), 0);
  const totalSinItbis  = totalVentas - totalItbis;
  const pendienteCobro = cobros.filter(c => c.estado !== 'pagado')
                               .reduce((s,c) => s + (parseFloat(c.monto_pendiente)||0), 0);

  document.getElementById('rep-ventas').textContent     = formatMoney(totalVentas);
  document.getElementById('rep-sin-itbis').textContent  = formatMoney(totalSinItbis);
  document.getElementById('rep-itbis').textContent      = formatMoney(totalItbis);
  document.getElementById('rep-ordenes').textContent    = ordPeriodo.length;
  document.getElementById('rep-clientes-new').textContent = clientes.filter(c => new Date(c.creado_en) >= desde).length;
  document.getElementById('rep-por-cobrar').textContent = formatMoney(pendienteCobro);

  // Top servicios
  const conteoArreglos = {};
  ordenes.forEach(o => {
    (o.arreglos||[]).forEach(a => {
      const k = a.descripcion;
      conteoArreglos[k] = (conteoArreglos[k]||0) + 1;
    });
  });
  const top = Object.entries(conteoArreglos)
    .sort((a,b) => b[1]-a[1]).slice(0,5);

  const topEl = document.getElementById('rep-top-servicios');
  if (top.length) {
    topEl.innerHTML = top.map(([desc, cnt], i) => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.82rem">
        <span>${i+1}. ${desc}</span>
        <span class="badge badge-yellow">${cnt} veces</span>
      </div>`).join('');
  } else {
    topEl.innerHTML = '<p class="text-muted text-sm">Sin datos aún</p>';
  }

  // Facturas por método de pago
  const metodos = {};
  facPeriodo.forEach(f => {
    metodos[f.metodo_pago||'efectivo'] = (metodos[f.metodo_pago||'efectivo']||0) + (f.total||0);
  });
  const metodosEl = document.getElementById('rep-metodos-pago');
  if (Object.keys(metodos).length) {
    metodosEl.innerHTML = Object.entries(metodos).map(([m, total]) => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.82rem">
        <span>${iconMetodo(m)} ${m.charAt(0).toUpperCase()+m.slice(1)}</span>
        <span class="mono">${formatMoney(total)}</span>
      </div>`).join('');
  } else {
    metodosEl.innerHTML = '<p class="text-muted text-sm">Sin facturas en el período</p>';
  }

  renderReparacionesPeriodo(ordPeriodo);
  renderComisionesPeriodo(comisiones.filter(c => new Date(c.creado_en) >= desde), mecanicos);
}

// ---- REPARACIONES DEL PERÍODO ----
function renderReparacionesPeriodo(ordPeriodo) {
  const arreglos = ordPeriodo.flatMap(o => o.arreglos || []);
  const total       = arreglos.length;
  const completadas = arreglos.filter(a => a.estado === 'listo').length;
  const enProceso   = arreglos.filter(a => a.estado === 'en_proceso').length;
  const enPrueba    = arreglos.filter(a => a.estado === 'prueba').length;

  const statsEl = document.getElementById('rep-reparaciones-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-card blue"><div class="label">Total</div><div class="value" style="font-size:1.2rem">${total}</div></div>
      <div class="stat-card green"><div class="label">✅ Completadas</div><div class="value" style="font-size:1.2rem">${completadas}</div></div>
      <div class="stat-card yellow"><div class="label">🔧 En Proceso</div><div class="value" style="font-size:1.2rem">${enProceso}</div></div>
      <div class="stat-card purple"><div class="label">🔵 En Prueba</div><div class="value" style="font-size:1.2rem">${enPrueba}</div></div>`;
  }

  const porMec = {};
  arreglos.forEach(a => {
    const nombre = a.mecanico_nombre || 'Sin asignar';
    if (!porMec[nombre]) porMec[nombre] = { total: 0, listas: 0 };
    porMec[nombre].total++;
    if (a.estado === 'listo') porMec[nombre].listas++;
  });

  const mecEl = document.getElementById('rep-reparaciones-mecanico');
  const entradas = Object.entries(porMec).sort((a,b) => b[1].total - a[1].total);
  if (mecEl) {
    mecEl.innerHTML = entradas.length
      ? entradas.map(([nombre, d]) => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.82rem">
          <span>🔧 ${nombre}</span>
          <span>${d.listas}/${d.total} completadas</span>
        </div>`).join('')
      : '<p class="text-muted text-sm">Sin reparaciones en el período</p>';
  }
}

// ---- COMISIONES POR MECÁNICO ----
let comisionesPeriodoActual = [];

function renderComisionesPeriodo(comisionesPeriodo, mecanicos) {
  comisionesPeriodoActual = comisionesPeriodo;
  const nombreMec = id => mecanicos.find(m => m.id === id);

  const porMec = {};
  comisionesPeriodo.forEach(c => {
    if (!porMec[c.mecanico_id]) porMec[c.mecanico_id] = { manoObra: 0, comision: 0, pagado: 0, pendiente: 0, reparaciones: 0 };
    const g = porMec[c.mecanico_id];
    g.manoObra += parseFloat(c.mano_obra_total || 0);
    g.comision += parseFloat(c.monto_comision || 0);
    g.reparaciones++;
    if (c.estado === 'pagado') g.pagado += parseFloat(c.monto_comision || 0);
    else g.pendiente += parseFloat(c.monto_comision || 0);
  });

  const tbody = document.getElementById('rep-comisiones-tbody');
  if (!tbody) return;
  const filas = Object.entries(porMec);
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="6">${emptyState('💰','Sin comisiones en el período','Aparecerán aquí cuando factures órdenes con mecánico asignado')}</td></tr>`;
    return;
  }
  tbody.innerHTML = filas.map(([mecId, d]) => {
    const mec = nombreMec(parseInt(mecId));
    const nombre = mec ? `${mec.nombre} ${mec.apellido||''}`.trim() : `Mecánico #${mecId}`;
    return `
    <tr>
      <td><strong>${nombre}</strong></td>
      <td class="mono text-sm">${d.reparaciones}</td>
      <td class="mono text-sm">${formatMoney(d.manoObra)}</td>
      <td class="mono text-sm">${formatMoney(d.comision)}</td>
      <td class="mono text-sm" style="color:var(--green)">${formatMoney(d.pagado)}</td>
      <td class="mono text-sm" style="color:var(--red)">${formatMoney(d.pendiente)}</td>
    </tr>`;
  }).join('');
}

async function exportarComisionesCSV() {
  if (!comisionesPeriodoActual.length) { showToast('No hay comisiones que exportar en este período', 'error'); return; }
  const mecanicos = await dbGetAll('mecanicos');
  const headers = ['Mecánico','Orden','Fecha','Mano de Obra','%','Comisión','Estado'];
  const rows = comisionesPeriodoActual.map(c => {
    const mec = mecanicos.find(m => m.id === c.mecanico_id);
    const nombre = mec ? `${mec.nombre} ${mec.apellido||''}`.trim() : `Mecánico #${c.mecanico_id}`;
    return [nombre, `#${String(c.orden_id).padStart(4,'0')}`, formatDate(c.creado_en),
      c.mano_obra_total, c.porcentaje, c.monto_comision, c.estado];
  });
  const csvVal = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(r => r.map(csvVal).join(',')).join('\n');
  const blob = new Blob(['﻿'+csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'comisiones_mecanicos.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('Archivo descargado', 'success');
}

function iconMetodo(m) {
  return {efectivo:'💵',tarjeta:'💳',transferencia:'🏦',cheque:'📋'}[m]||'💰';
}

async function exportarReporteCSV(tipo) {
  let rows = [], headers = [], filename = '';

  if (tipo === 'facturas') {
    const data = await dbGetAll('facturas');
    headers = ['Número','Fecha','Cliente','NCF','Subtotal','ITBIS','Total','Método Pago'];
    rows = data.map(f => [f.numero, formatDate(f.creado_en), f.cliente_nombre,
      f.ncf||'', f.subtotal, f.itbis, f.total, f.metodo_pago]);
    filename = 'facturas.csv';
  } else if (tipo === 'clientes') {
    const data = await dbGetAll('clientes');
    headers = ['Nombre','Cédula','RNC','Teléfono','Email','Dirección'];
    rows = data.map(c => [c.nombre, c.cedula||'', c.rnc||'', c.telefono||'', c.email||'', c.direccion||'']);
    filename = 'clientes.csv';
  } else if (tipo === 'inventario') {
    const data = await dbGetAll('repuestos');
    headers = ['Código','Nombre','Categoría','Stock','Stock Mín','P.Costo','P.Venta'];
    rows = data.map(r => [r.codigo||'', r.nombre, r.categoria||'', r.stock, r.stock_min, r.precio_costo, r.precio_venta]);
    filename = 'inventario.csv';
  }

  // Escapar comillas dobles ("" es el estándar CSV) — si no, un valor con
  // comillas (ej. una dirección o nota) corta la columna a la mitad y
  // desalinea el resto del archivo al abrirlo en Excel/Sheets.
  const csvVal = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(r => r.map(csvVal).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast('Archivo descargado', 'success');
}
