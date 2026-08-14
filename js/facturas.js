// ============================================================
// FACTURAS.JS — Módulo de facturación reescrito desde cero
// ============================================================

let facturaActual = null;

// ---- LISTAR FACTURAS ----
async function cargarFacturas(busqueda = '') {
  const tbody = document.getElementById('facturas-tbody');
  if (tbody) tbody.innerHTML = skeletonRows(6, 4);

  try {
    const todas = await dbGetAll('facturas');
    const filtradas = busqueda
      ? todas.filter(f =>
          (f.numero||'').toLowerCase().includes(busqueda.toLowerCase()) ||
          (f.cliente_nombre||'').toLowerCase().includes(busqueda.toLowerCase()))
      : todas;

    if (!tbody) return;

    if (!filtradas.length) {
      tbody.innerHTML = `<tr><td colspan="6">${emptyState('🧾','Sin facturas','Las facturas aparecerán cuando factures una orden')}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtradas.map(f => `
      <tr>
        <td class="mono text-xs">${f.numero||'—'}</td>
        <td><strong>${f.cliente_nombre||'—'}</strong></td>
        <td>${f.vehiculo_desc||'—'}</td>
        <td class="mono">${formatMoney(f.total||0)}</td>
        <td>${f.metodo_pago||'—'}</td>
        <td>${formatDate(f.creado_en)}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-xs btn-ghost" onclick="verFactura(${f.id})">👁 Ver</button>
            <button class="btn btn-xs btn-ghost" onclick="imprimirFactura(${f.id})">🖨 Imprimir</button>
          </div>
        </td>
      </tr>`).join('');
  } catch(err) {
    console.error('Error cargando facturas:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6"><p class="text-muted text-sm" style="padding:20px">Error cargando facturas</p></td></tr>`;
  }
}

// ---- ABRIR MODAL DE FACTURA ----
async function facturarOrden(ordenId) {
  try {
    const orden = await dbGet('ordenes', ordenId);
    if (!orden) { showToast('Orden no encontrada', 'error'); return; }

    const cliente  = orden.cliente_id  ? await dbGet('clientes',  orden.cliente_id)  : null;
    const vehiculo = orden.vehiculo_id ? await dbGet('vehiculos', orden.vehiculo_id) : null;

    // Calcular totales desde arreglos
    const arreglos = Array.isArray(orden.arreglos) ? orden.arreglos : [];
    let subtotal = 0;
    arreglos.forEach(a => {
      subtotal += parseFloat(a.manoObra || a.mano_obra || 0);
      (a.repuestos || []).forEach(r => {
        subtotal += parseFloat(r.precio || 0) * parseFloat(r.cantidad || 1);
      });
    });

    const itbisPct = parseFloat(await getConfig('itbis') || '18') / 100;
    const itbis    = subtotal * itbisPct;
    const total    = subtotal + itbis;

    facturaActual = { orden, cliente, vehiculo, arreglos, subtotal, itbis, itbisPct, total };

    // Llenar modal
    document.getElementById('fac-orden-num').textContent      = `#${String(ordenId).padStart(4,'0')}`;
    document.getElementById('fac-cliente-nombre').value       = cliente?.nombre || '';
    document.getElementById('fac-cliente-cedula').value       = cliente?.cedula || '';
    document.getElementById('fac-cliente-rnc').value          = cliente?.rnc || '';
    document.getElementById('fac-vehiculo-desc').textContent  = vehiculo
      ? `${vehiculo.marca||''} ${vehiculo.modelo||''} ${vehiculo.anio||''} · ${vehiculo.placa||''}`.trim()
      : orden.vehiculo_placa || '—';
    document.getElementById('fac-subtotal').textContent       = formatMoney(subtotal);
    document.getElementById('fac-itbis-monto').textContent    = formatMoney(itbis);
    document.getElementById('fac-total').textContent          = formatMoney(total);
    document.getElementById('fac-itbis-pct').textContent      = Math.round(itbisPct * 100) + '%';

    // Arreglos
    const listaArr = document.getElementById('fac-arreglos-lista');
    if (listaArr) {
      listaArr.innerHTML = arreglos.map(a => `
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
          <span>${a.descripcion || '—'}</span>
          <span class="mono">${formatMoney(a.manoObra || a.mano_obra || 0)}</span>
        </div>`).join('') || '<p class="text-muted text-xs">Sin arreglos</p>';
    }

    // Métodos de pago
    await cargarMetodosPagoFac();

    // NCF: solo mostrar si hay secuencias configuradas
    await cargarSecuenciasFac();

    // Reset NCF toggle
    const ncfCheck = document.getElementById('fac-usar-ncf');
    if (ncfCheck) { ncfCheck.checked = false; toggleNcfFac(); }

    abrirModal('modal-facturar');

  } catch(err) {
    console.error('Error abriendo factura:', err);
    showToast('Error: ' + err.message, 'error');
  }
}

async function cargarMetodosPagoFac() {
  const sel = document.getElementById('fac-metodo-pago');
  if (!sel) return;
  try {
    const metodos = await dbGetAll('metodos_pago');
    const activos = metodos.filter(m => m.activo !== false).sort((a,b) => (a.orden||0)-(b.orden||0));
    if (activos.length) {
      sel.innerHTML = activos.map(m =>
        `<option value="${m.nombre}">${m.icono||'💳'} ${m.nombre}</option>`
      ).join('');
    } else {
      sel.innerHTML = `
        <option value="Efectivo">💵 Efectivo</option>
        <option value="Tarjeta Débito">💳 Tarjeta Débito</option>
        <option value="Tarjeta Crédito">💳 Tarjeta Crédito</option>
        <option value="Transferencia">🏦 Transferencia</option>`;
    }
  } catch(e) {
    sel.innerHTML = `<option value="Efectivo">💵 Efectivo</option>`;
  }
}

async function cargarSecuenciasFac() {
  const sel = document.getElementById('fac-ncf-tipo');
  if (!sel) return;
  try {
    const { data } = await getClient()
      .from('secuencias')
      .select('*')
      .eq('activa', true);

    const activas = (data||[]).filter(s => s.actual <= s.hasta);
    if (activas.length) {
      sel.innerHTML = '<option value="">— Sin comprobante —</option>' +
        activas.map(s => `<option value="${s.tipo}">[${s.formato||''}] ${s.nombre}</option>`).join('');
    } else {
      sel.innerHTML = '<option value="">— Sin secuencias configuradas —</option>';
    }
  } catch(e) {
    sel.innerHTML = '<option value="">— Sin comprobante —</option>';
  }
}

function toggleNcfFac() {
  const usar = document.getElementById('fac-usar-ncf')?.checked;
  const sec  = document.getElementById('seccion-ncf');
  if (sec) sec.style.display = usar ? 'block' : 'none';
}

// ---- CONFIRMAR Y GUARDAR FACTURA ----
async function confirmarFactura() {
  if (!facturaActual) { showToast('No hay factura activa', 'error'); return; }

  const btn = document.getElementById('btn-confirmar-factura');
  btnLoading(btn, 'Generando...');

  try {
    // NCF opcional
    let ncf = null, tipoNcf = null, formatoNcf = null;
    const usarNcf  = document.getElementById('fac-usar-ncf')?.checked;
    const tipoSel  = document.getElementById('fac-ncf-tipo')?.value;

    if (usarNcf && tipoSel) {
      const { data: sec } = await getClient()
        .from('secuencias').select('*').eq('tipo', tipoSel).single();

      if (!sec || sec.actual > sec.hasta) {
        showToast('Secuencia agotada o no configurada', 'error');
        btnReset(btn); return;
      }

      // Generar NCF
      const num = sec.actual;
      if (tipoSel.startsWith('e')) {
        ncf = 'E' + tipoSel.substring(1) + String(num).padStart(10,'0');
      } else {
        ncf = tipoSel + String(num).padStart(8,'0');
      }
      tipoNcf    = sec.nombre;
      formatoNcf = sec.formato;

      // Incrementar secuencia
      await getClient().from('secuencias')
        .update({ actual: num + 1 }).eq('tipo', tipoSel);
    }

    // Número de factura
    const { count } = await getClient()
      .from('facturas').select('*', { count: 'exact', head: true });
    const numero = 'FAC-' + String((count || 0) + 1).padStart(5, '0');

    // Datos del negocio
    const negocio = {
      nombre:   await getConfig('negocio_nombre') || '',
      rnc:      await getConfig('negocio_rnc') || '',
      telefono: await getConfig('negocio_telefono') || '',
      direccion:await getConfig('negocio_direccion') || '',
    };

    const vehiculo = facturaActual.vehiculo;
    const factura = {
      numero,
      orden_id:       facturaActual.orden.id,
      cliente_id:     facturaActual.cliente?.id || null,
      cliente_nombre: document.getElementById('fac-cliente-nombre').value || '',
      cliente_cedula: document.getElementById('fac-cliente-cedula').value || '',
      cliente_rnc:    document.getElementById('fac-cliente-rnc').value || '',
      vehiculo_placa: vehiculo?.placa || facturaActual.orden.vehiculo_placa || '',
      vehiculo_desc:  vehiculo
        ? `${vehiculo.marca||''} ${vehiculo.modelo||''} ${vehiculo.anio||''}`.trim()
        : facturaActual.orden.vehiculo_placa || '',
      arreglos:       facturaActual.arreglos,
      subtotal:       facturaActual.subtotal,
      itbis:          facturaActual.itbis,
      itbis_pct:      facturaActual.itbisPct * 100,
      total:          facturaActual.total,
      ncf:            ncf,
      tipo_ncf:       tipoNcf,
      formato_ncf:    formatoNcf,
      metodo_pago:    document.getElementById('fac-metodo-pago')?.value || 'Efectivo',
      negocio,
    };

    // Guardar factura
    const facturaId = await dbAdd('facturas', factura);
    if (!facturaId) throw new Error('No se pudo guardar la factura');

    // Actualizar orden a entregado
    await getClient().from('ordenes')
      .update({ estado_orden: 'entregado', factura_id: facturaId })
      .eq('id', facturaActual.orden.id);

    // Comisión mecánico
    const totalMO = facturaActual.arreglos.reduce((s,a) => s + parseFloat(a.manoObra||a.mano_obra||0), 0);
    if (totalMO > 0 && typeof registrarComisionMecanico === 'function') {
      await registrarComisionMecanico(facturaActual.orden.id, facturaId, totalMO);
    }

    cerrarModal('modal-facturar');
    showToast(`✅ Factura ${numero} generada`, 'success');

    if (typeof cargarFacturas === 'function') cargarFacturas();
    if (typeof cargarOrdenes === 'function') cargarOrdenes();
    if (typeof actualizarDashboard === 'function') actualizarDashboard();

    setTimeout(() => verFactura(facturaId), 600);

  } catch(err) {
    console.error('confirmarFactura error:', err);
    showToast('Error: ' + (err.message || 'No se pudo generar la factura'), 'error');
  } finally {
    btnReset(btn);
  }
}

// ---- VER FACTURA ----
async function verFactura(id) {
  try {
    const f = await dbGet('facturas', id);
    if (!f) { showToast('Factura no encontrada', 'error'); return; }

    const arreglos = Array.isArray(f.arreglos) ? f.arreglos : [];
    const neg = f.negocio || {};

    document.getElementById('factura-preview-content').innerHTML = `
      <div class="factura-preview">
        <div class="fac-header">
          <div class="fac-logo">
            <h2>${neg.nombre || 'Mi Taller'}</h2>
            <p>${neg.direccion || ''}</p>
            <p>${neg.telefono || ''}</p>
            ${neg.rnc ? `<p>RNC: ${neg.rnc}</p>` : ''}
          </div>
          <div class="fac-num">
            <h3>Factura</h3>
            <div class="num">${f.numero}</div>
            ${f.ncf ? `<div class="ncf">${f.ncf}</div><div style="font-size:0.65rem;color:#999">${f.tipo_ncf||''}</div>` : ''}
            <div style="font-size:0.7rem;color:#999;margin-top:4px">${formatDate(f.creado_en)}</div>
          </div>
        </div>

        ${f.ncf ? `<div class="fac-ncf-box">📋 Comprobante Fiscal: <strong>${f.ncf}</strong> · ${f.tipo_ncf||''}</div>` : ''}

        <div class="fac-parties">
          <div class="fac-party">
            <h4>Cliente</h4>
            <p><strong>${f.cliente_nombre||'—'}</strong></p>
            ${f.cliente_cedula ? `<p>Cédula: ${f.cliente_cedula}</p>` : ''}
            ${f.cliente_rnc ? `<p>RNC: ${f.cliente_rnc}</p>` : ''}
          </div>
          <div class="fac-party">
            <h4>Vehículo</h4>
            <p>${f.vehiculo_desc||'—'}</p>
            ${f.vehiculo_placa ? `<p>Placa: <strong>${f.vehiculo_placa}</strong></p>` : ''}
          </div>
        </div>

        <table class="fac-table">
          <thead><tr><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead>
          <tbody>
            ${arreglos.map(a => {
              const mo = parseFloat(a.manoObra||a.mano_obra||0);
              const rows = [`<tr><td>${a.descripcion||'—'}</td><td>1</td><td>${formatMoney(mo)}</td><td>${formatMoney(mo)}</td></tr>`];
              (a.repuestos||[]).forEach(r => {
                const sub = parseFloat(r.precio||0) * parseFloat(r.cantidad||1);
                rows.push(`<tr><td>&nbsp;&nbsp;↳ ${r.nombre||r.descripcion||'Repuesto'}</td><td>${r.cantidad||1}</td><td>${formatMoney(r.precio||0)}</td><td>${formatMoney(sub)}</td></tr>`);
              });
              return rows.join('');
            }).join('')}
          </tbody>
        </table>

        <div style="display:flex;justify-content:flex-end">
          <div class="fac-totals">
            <div class="row"><span>Subtotal</span><span class="mono">${formatMoney(f.subtotal||0)}</span></div>
            <div class="row"><span>ITBIS (${f.itbis_pct||18}%)</span><span class="mono">${formatMoney(f.itbis||0)}</span></div>
            <div class="row total"><span>TOTAL</span><span class="mono">${formatMoney(f.total||0)}</span></div>
          </div>
        </div>

        <div class="fac-footer">
          <p>Método de pago: <strong>${f.metodo_pago||'—'}</strong></p>
          <p style="margin-top:6px">¡Gracias por su preferencia!</p>
        </div>
      </div>`;

    abrirModal('modal-ver-factura');
  } catch(err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function imprimirFactura(id) {
  verFactura(id).then(() => {
    setTimeout(() => window.print(), 500);
  });
}
