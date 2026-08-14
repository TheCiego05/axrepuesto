// ============================================================
// MECANICOS.JS — Gestión de mecánicos y comisiones
// ============================================================

let mecanicoEditId = null;

// ---- CARGAR MECÁNICOS ----
async function cargarMecanicos() {
  const tbody = document.getElementById('mecanicos-tbody');
  if (tbody) tbody.innerHTML = skeletonRows(6, 4);

  const todos = await dbGetAll('mecanicos');
  const activos = todos.filter(m => m.activo !== false);

  if (tbody) {
    if (!todos.length) {
      tbody.innerHTML = `<tr><td colspan="6">${emptyState('🔧', 'Sin mecánicos', 'Agrega el primer mecánico del taller', '+ Agregar Mecánico', 'abrirModalMecanico()')}</td></tr>`;
      return;
    }
    tbody.innerHTML = todos.map(m => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#1C4475,#009EED);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.75rem;flex-shrink:0">
              ${m.nombre.charAt(0)}${m.apellido?.charAt(0)||''}
            </div>
            <div>
              <strong style="font-size:0.8rem">${m.nombre} ${m.apellido||''}</strong>
              <div class="text-xs text-muted">${m.especialidad||'General'}</div>
            </div>
          </div>
        </td>
        <td>${m.telefono||'—'}</td>
        <td>${m.email||'—'}</td>
        <td><span class="badge badge-blue">${m.porcentaje_mo||40}% MO</span></td>
        <td><span class="badge ${m.activo!==false?'badge-green':'badge-gray'}">${m.activo!==false?'Activo':'Inactivo'}</span></td>
        <td>
          <div class="td-actions">
            <button class="btn btn-xs btn-ghost" onclick="verComisionesMecanico(${m.id})">💰 Comisiones</button>
            <button class="btn btn-xs btn-ghost" onclick="abrirModalMecanico(${m.id})">✏️</button>
            <button class="btn btn-xs btn-danger" onclick="toggleMecanico(${m.id}, ${!m.activo})">${m.activo!==false?'Desactivar':'Activar'}</button>
          </div>
        </td>
      </tr>`).join('');
  }

  // Actualizar selects de mecánicos en otros módulos
  await poblarSelectsMecanicos(activos);
}

async function poblarSelectsMecanicos(mecanicos = null) {
  if (!mecanicos) mecanicos = (await dbGetAll('mecanicos')).filter(m => m.activo !== false);

  const opts = '<option value="">— Seleccionar mecánico —</option>' +
    mecanicos.map(m => `<option value="${m.id}" data-nombre="${m.nombre} ${m.apellido||''}">${m.nombre} ${m.apellido||''} · ${m.especialidad||'General'}</option>`).join('');

  ['ord-mecanico', 'turno-mecanico'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) sel.innerHTML = opts;
  });
}

function seleccionarMecanico(sel) {
  const opt = sel.options[sel.selectedIndex];
  const nombreEl = document.getElementById('ord-mecanico-nombre');
  const idEl = document.getElementById('ord-mecanico-id');
  if (nombreEl) nombreEl.value = opt?.dataset?.nombre || '';
  if (idEl) idEl.value = sel.value;
}

// ---- MODAL MECÁNICO ----
async function abrirModalMecanico(id = null) {
  mecanicoEditId = id;
  document.getElementById('modal-mecanico-titulo').textContent = id ? 'Editar Mecánico' : 'Nuevo Mecánico';

  ['mec-nombre','mec-apellido','mec-telefono','mec-email','mec-especialidad','mec-porcentaje'].forEach(fid => {
    const el = document.getElementById(fid);
    if (el) el.value = fid === 'mec-porcentaje' ? '40' : '';
  });

  if (id) {
    const m = await dbGet('mecanicos', id);
    if (!m) return;
    document.getElementById('mec-nombre').value        = m.nombre || '';
    document.getElementById('mec-apellido').value      = m.apellido || '';
    document.getElementById('mec-telefono').value      = m.telefono || '';
    document.getElementById('mec-email').value         = m.email || '';
    document.getElementById('mec-especialidad').value  = m.especialidad || '';
    document.getElementById('mec-porcentaje').value    = m.porcentaje_mo || 40;
  }

  abrirModal('modal-mecanico');
}

async function guardarMecanico() {
  const btn = document.querySelector('#modal-mecanico .btn-primary');
  const nombre = document.getElementById('mec-nombre')?.value.trim();
  if (!nombre) { showToast('El nombre es requerido', 'error'); return; }

  const data = {
    nombre,
    apellido:      document.getElementById('mec-apellido')?.value.trim() || '',
    telefono:      document.getElementById('mec-telefono')?.value.trim() || '',
    email:         document.getElementById('mec-email')?.value.trim() || '',
    especialidad:  document.getElementById('mec-especialidad')?.value.trim() || '',
    porcentaje_mo: parseFloat(document.getElementById('mec-porcentaje')?.value) || 40,
    activo: true,
  };

  btnLoading(btn, 'Guardando...');
  try {
    if (mecanicoEditId) {
      const ex = await dbGet('mecanicos', mecanicoEditId);
      await dbUpdate('mecanicos', { ...ex, ...data, id: mecanicoEditId });
      showToast('Mecánico actualizado', 'success');
    } else {
      await dbAdd('mecanicos', data);
      showToast('Mecánico agregado', 'success');
    }
    cerrarModal('modal-mecanico');
    cargarMecanicos();
  } catch(err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btnReset(btn);
  }
}

async function toggleMecanico(id, activar) {
  const m = await dbGet('mecanicos', id);
  await dbUpdate('mecanicos', { ...m, activo: activar });
  showToast(activar ? 'Mecánico activado' : 'Mecánico desactivado', 'info');
  cargarMecanicos();
}

// ---- COMISIONES ----
async function verComisionesMecanico(mecanicoId) {
  const m = await dbGet('mecanicos', mecanicoId);
  if (!m) return;

  const comisiones = await dbGetAll('comisiones_mecanicos');
  const misCom = comisiones.filter(c => c.mecanico_id === mecanicoId);
  const pendientes = misCom.filter(c => c.estado === 'pendiente');
  const pagadas    = misCom.filter(c => c.estado === 'pagado');
  const totalPend  = pendientes.reduce((s,c) => s + (c.monto_comision||0), 0);
  const totalPag   = pagadas.reduce((s,c) => s + (c.monto_comision||0), 0);

  // Mostrar en modal
  document.getElementById('com-mecanico-nombre').textContent = `${m.nombre} ${m.apellido||''}`;
  document.getElementById('com-total-pendiente').textContent = formatMoney(totalPend);
  document.getElementById('com-total-pagado').textContent    = formatMoney(totalPag);

  const lista = document.getElementById('com-lista');
  if (!misCom.length) {
    lista.innerHTML = emptyState('💰', 'Sin comisiones', 'Las comisiones aparecen al facturar órdenes asignadas');
  } else {
    lista.innerHTML = misCom.map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
        <div style="flex:1">
          <strong>Orden #${String(c.orden_id).padStart(4,'0')}</strong>
          <div class="text-xs text-muted">MO: ${formatMoney(c.mano_obra_total)} · ${c.porcentaje}%</div>
        </div>
        <strong style="color:var(--green)">${formatMoney(c.monto_comision)}</strong>
        <span class="badge ${c.estado==='pagado'?'badge-green':'badge-yellow'}">${c.estado==='pagado'?'✅ Pagado':'⏳ Pendiente'}</span>
        ${c.estado==='pendiente' ? `<button class="btn btn-xs btn-green" onclick="marcarComisionPagada(${c.id})">Marcar pagado</button>` : ''}
      </div>`).join('');
  }

  // Guardar mecanicoId para pagar todas
  document.getElementById('modal-comisiones').dataset.mecanicoId = mecanicoId;
  abrirModal('modal-comisiones');
}

async function marcarComisionPagada(comisionId) {
  const c = await dbGet('comisiones_mecanicos', comisionId);
  await dbUpdate('comisiones_mecanicos', { ...c, estado: 'pagado', fecha_pago: new Date().toISOString() });
  showToast('Comisión marcada como pagada', 'success');
  const mecId = parseInt(document.getElementById('modal-comisiones').dataset.mecanicoId);
  verComisionesMecanico(mecId);
}

async function pagarTodasComisiones() {
  const mecId = parseInt(document.getElementById('modal-comisiones').dataset.mecanicoId);
  if (!await confirmar('¿Marcar todas las comisiones pendientes como pagadas?')) return;

  const comisiones = await dbGetAll('comisiones_mecanicos');
  const pendientes = comisiones.filter(c => c.mecanico_id === mecId && c.estado === 'pendiente');

  for (const c of pendientes) {
    await dbUpdate('comisiones_mecanicos', { ...c, estado: 'pagado', fecha_pago: new Date().toISOString() });
  }

  showToast(`${pendientes.length} comisión(es) pagada(s)`, 'success');
  verComisionesMecanico(mecId);
}

// Calcular y registrar comisión al facturar
async function registrarComisionMecanico(ordenId, facturaId, totalManoObra) {
  try {
    const orden = await dbGet('ordenes', ordenId);
    if (!orden?.mecanico_id) return;

    const mecanico = await dbGet('mecanicos', orden.mecanico_id);
    if (!mecanico) return;

    const pct    = mecanico.porcentaje_mo || 40;
    const monto  = (totalManoObra * pct) / 100;

    await dbAdd('comisiones_mecanicos', {
      mecanico_id:     mecanico.id,
      orden_id:        ordenId,
      factura_id:      facturaId,
      mano_obra_total: totalManoObra,
      porcentaje:      pct,
      monto_comision:  monto,
      estado:          'pendiente',
    });
  } catch(e) {
    console.error('Error registrando comisión:', e);
  }
}
