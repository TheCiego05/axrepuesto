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

  const [facturas, ordenes, clientes, cobros] = await Promise.all([
    dbGetAll('facturas'), dbGetAll('ordenes'),
    dbGetAll('clientes'), dbGetAll('cuentas_cobrar')
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

  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast('Archivo descargado', 'success');
}
