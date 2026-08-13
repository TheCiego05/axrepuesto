// ============================================================
// ORDENES.JS — Llave10 (estados completos)
// ============================================================
let ordenEditId = null;
let arreglosTemp = [];
let ordenArregloId = null;

const ESTADOS_ORDEN = [
  { key:'recibido',   label:'🔵 Recibido',   cls:'badge-blue' },
  { key:'en_taller',  label:'🔧 En Taller',  cls:'badge-yellow' },
  { key:'listo',      label:'✅ Listo',       cls:'badge-green' },
  { key:'entregado',  label:'🚗 Entregado',  cls:'badge-gray' },
];

async function cargarOrdenes(busqueda='', filtroEstado='') {
  const todas = await dbGetAll('ordenes');
  let filtradas = todas;
  if (busqueda) {
    const q = busqueda.toLowerCase();
    filtradas = filtradas.filter(o =>
      o.cliente_nombre?.toLowerCase().includes(q) ||
      o.vehiculo_placa?.toLowerCase().includes(q) ||
      String(o.id).includes(q)
    );
  }
  if (filtroEstado) filtradas = filtradas.filter(o => o.estado_orden === filtroEstado);
  filtradas.sort((a,b) => new Date(b.creado_en)-new Date(a.creado_en));

  const container = document.getElementById('ordenes-lista');
  if (!filtradas.length) {
    container.innerHTML = `<div class="empty-state"><div class="ico">📝</div><h3>No hay órdenes</h3><p>Crea la primera orden cuando llegue un cliente</p></div>`;
    return;
  }

  container.innerHTML = filtradas.map(o => {
    const arreglos    = o.arreglos || [];
    const totalArr    = arreglos.length;
    const listos      = arreglos.filter(a => a.estado === 'listo').length;
    const todosListos = totalArr > 0 && listos === totalArr;
    const puedeFacturar = o.estado_orden === 'listo';
    return `
    <div class="orden-card">
      <div class="orden-header" onclick="toggleOrden(${o.id})">
        <div class="orden-info">
          <h4>🚗 ${o.vehiculo_marca||''} ${o.vehiculo_modelo||''} ${o.vehiculo_anio||''} <span class="mono" style="font-size:0.72rem;color:var(--text2)">· ${o.vehiculo_placa||'—'}</span>
            <span class="prioridad-${o.prioridad}" style="font-size:0.72rem;margin-left:6px">${iconPrioridad(o.prioridad)}</span>
          </h4>
          <p>👤 ${o.cliente_nombre||'—'} · 📅 ${formatDate(o.creado_en)} · ${totalArr} arreglo(s), ${listos} listo(s)${o.mecanico?' · 🔧 '+o.mecanico:''}</p>
        </div>
        <div class="orden-meta" style="gap:6px">
          ${badgeEstadoOrden(o.estado_orden)}
          <select class="form-control" style="width:160px;font-size:0.72rem;padding:4px 6px" onchange="event.stopPropagation();cambiarEstadoOrden(${o.id},this.value)" onclick="event.stopPropagation()">
            ${ESTADOS_ORDEN.map(e => `<option value="${e.key}" ${o.estado_orden===e.key?'selected':''}>${e.label}</option>`).join('')}
          </select>
          ${o.estado_orden === 'listo' || o.estado_orden === 'entregado' ? `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();facturarOrden(${o.id})">🧾 Facturar</button>` : ''}
          <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();editarOrden(${o.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();eliminarOrden(${o.id})">🗑️</button>
        </div>
      </div>
      <div class="orden-body" id="orden-body-${o.id}" style="display:none">
        ${o.sintomas ? `<p class="text-sm text-muted mt-2">🩺 <strong>Síntomas:</strong> ${o.sintomas}</p>` : ''}
        ${o.diagnostico ? `<p class="text-sm text-muted mt-2">🔍 <strong>Diagnóstico:</strong> ${o.diagnostico}</p>` : ''}
        ${o.notas ? `<p class="text-sm text-muted mt-2">📝 ${o.notas}</p>` : ''}
        <div id="arreglos-${o.id}">${renderArreglos(o)}</div>
        <button class="btn btn-sm btn-ghost mt-3" onclick="abrirModalArreglo(${o.id})">+ Agregar Arreglo</button>
      </div>
    </div>`;
  }).join('');
}

function toggleOrden(id) {
  const b = document.getElementById(`orden-body-${id}`);
  b.style.display = b.style.display === 'none' ? 'block' : 'none';
}

function renderArreglos(orden) {
  const arreglos = orden.arreglos || [];
  if (!arreglos.length) return `<p class="text-sm text-muted mt-2">Sin arreglos aún</p>`;
  return arreglos.map((a,i) => {
    const repStr = (a.repuestos||[]).map(r=>`${r.nombre} x${r.cantidad}`).join(', ');
    return `
    <div class="arreglo-item">
      <div class="arreglo-desc">
        <strong>${a.descripcion}</strong>
        <span>Mano de obra: ${formatMoney(a.manoObra)}${repStr?' · Repuestos: '+repStr:''}</span>
        ${a.notas?`<span style="color:var(--text2);display:block;font-size:0.72rem">📝 ${a.notas}</span>`:''}
      </div>
      <div class="arreglo-actions">
        ${renderBotonesEstadoArreglo(orden.id,i,a.estado)}
        <button class="btn btn-xs btn-danger" onclick="eliminarArreglo(${orden.id},${i})">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function renderBotonesEstadoArreglo(ordenId, idx, estadoActual) {
  const estados = [
    { key:'en_proceso', icon:'🔧', label:'En Proceso', cls:'badge-yellow' },
    { key:'prueba',     icon:'🔵', label:'Prueba',     cls:'badge-blue' },
    { key:'listo',      icon:'✅', label:'Listo',      cls:'badge-green' },
  ];
  return estados.map(e => {
    const activo = estadoActual === e.key;
    return `<button class="estado-btn ${activo?'badge '+e.cls:'badge badge-gray'}"
      onclick="cambiarEstadoArreglo(${ordenId},${idx},'${e.key}')">${e.icon} ${e.label}</button>`;
  }).join('');
}

async function cambiarEstadoOrden(ordenId, nuevoEstado) {
  const orden = await dbGet('ordenes', ordenId);
  if (!orden) return;
  await dbUpdate('ordenes', { ...orden, estado_orden: nuevoEstado });
  cargarOrdenes();
  actualizarDashboard();
  showToast('Estado actualizado', 'success');
}

async function cambiarEstadoArreglo(ordenId, idx, nuevoEstado) {
  const orden = await dbGet('ordenes', ordenId);
  orden.arreglos[idx].estado = nuevoEstado;
  // Si todos los arreglos están listos, avanzar orden a listo
  const todos = orden.arreglos.every(a => a.estado === 'listo');
  if (todos && orden.estado_orden === 'en_taller') orden.estado_orden = 'listo';
  await dbUpdate('ordenes', orden);
  cargarOrdenes();
  showToast('Estado actualizado', 'success');
}

async function eliminarArreglo(ordenId, idx) {
  if (!await confirmar('¿Eliminar este arreglo?')) return;
  const orden = await dbGet('ordenes', ordenId);
  orden.arreglos.splice(idx, 1);
  await dbUpdate('ordenes', orden);
  cargarOrdenes();
}

async function abrirModalOrden() {
  ordenEditId = null; arreglosTemp = [];
  document.getElementById('form-orden').reset();
  document.getElementById('orden-modal-titulo').textContent = 'Nueva Orden de Trabajo';
  await poblarSelectCliente('ord-cliente');
  document.getElementById('ord-vehiculo').innerHTML = '<option value="">— Seleccione cliente —</option>';
  renderArreglosTemp();
  abrirModal('modal-orden');
}

async function editarOrden(id) {
  ordenEditId = id;
  const orden = await dbGet('ordenes', id);
  arreglosTemp = [...(orden.arreglos||[])];
  document.getElementById('orden-modal-titulo').textContent = 'Editar Orden';
  await poblarSelectCliente('ord-cliente');
  document.getElementById('ord-cliente').value = orden.cliente_id||'';
  await cargarVehiculosOrden(orden.cliente_id);
  document.getElementById('ord-vehiculo').value         = orden.vehiculo_id||'';
  document.getElementById('ord-mecanico').value         = orden.mecanico||'';
  document.getElementById('ord-prioridad').value        = orden.prioridad||'normal';
  document.getElementById('ord-km').value               = orden.kilometraje||'';
  document.getElementById('ord-estado-inicial').value   = orden.estado_orden||'borrador';
  document.getElementById('ord-sintomas').value         = orden.sintomas||'';
  document.getElementById('ord-notas').value            = orden.notas||'';
  renderArreglosTemp();
  abrirModal('modal-orden');
}

async function poblarSelectCliente(selectId) {
  const clientes = await dbGetAll('clientes');
  const sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="">— Seleccione cliente —</option>' +
    clientes.map(c=>`<option value="${c.id}">${c.nombre}${c.cedula?' ('+c.cedula+')':''}</option>`).join('');
}

async function cargarVehiculosOrden(clienteId) {
  const sel = document.getElementById('ord-vehiculo');
  if (!clienteId) { sel.innerHTML = '<option>— Seleccione cliente —</option>'; return; }
  const vehiculos = await dbGetByIndex('vehiculos', 'cliente_id', parseInt(clienteId));
  sel.innerHTML = '<option value="">— Seleccione vehículo —</option>' +
    vehiculos.map(v=>`<option value="${v.id}">${v.marca} ${v.modelo} ${v.anio||''} — ${v.placa||'S/P'}</option>`).join('');
}

function abrirFormArreglo() {
  document.getElementById('form-arreglo-temp').reset();
  abrirModal('modal-arreglo-temp');
}

function guardarArregloTemp() {
  const desc = document.getElementById('at-descripcion').value.trim();
  if (!desc) { showToast('Descripción requerida', 'error'); return; }
  arreglosTemp.push({
    descripcion: desc,
    manoObra: parseFloat(document.getElementById('at-mano-obra').value)||0,
    notas: document.getElementById('at-notas').value.trim(),
    estado: 'en_proceso', repuestos: [],
  });
  cerrarModal('modal-arreglo-temp');
  renderArreglosTemp();
}

function renderArreglosTemp() {
  const c = document.getElementById('arreglos-temp-lista');
  if (!arreglosTemp.length) {
    c.innerHTML = '<p class="text-sm text-muted" style="padding:10px 0">Sin arreglos. Agrega al menos uno.</p>';
    return;
  }
  c.innerHTML = arreglosTemp.map((a,i) => `
    <div class="arreglo-item">
      <div class="arreglo-desc"><strong>${a.descripcion}</strong><span>${formatMoney(a.manoObra)}</span></div>
      <div class="arreglo-actions"><button class="btn btn-xs btn-danger" onclick="eliminarArregloTemp(${i})">🗑️</button></div>
    </div>`).join('');
}

function eliminarArregloTemp(i) { arreglosTemp.splice(i,1); renderArreglosTemp(); }

async function guardarOrden() {
  const clienteId  = parseInt(document.getElementById('ord-cliente').value);
  const vehiculoId = parseInt(document.getElementById('ord-vehiculo').value);
  if (!clienteId)   { showToast('Selecciona un cliente', 'error');  return; }
  if (!vehiculoId)  { showToast('Selecciona un vehículo', 'error'); return; }
  if (!arreglosTemp.length) { showToast('Agrega al menos un arreglo', 'error'); return; }

  const cliente  = await dbGet('clientes', clienteId);
  const vehiculo = await dbGet('vehiculos', vehiculoId);
  const u        = getUsuarioActual();

  const data = {
    cliente_id: clienteId, vehiculo_id: vehiculoId,
    cliente_nombre: cliente.nombre,
    vehiculo_placa: vehiculo.placa,
    vehiculo_marca: vehiculo.marca,
    vehiculo_modelo: vehiculo.modelo,
    mecanico:       document.getElementById('ord-mecanico').value.trim(),
    prioridad:      document.getElementById('ord-prioridad').value,
    kilometraje:    parseInt(document.getElementById('ord-km').value)||null,
    estado_orden:   document.getElementById('ord-estado-inicial').value,
    sintomas:       document.getElementById('ord-sintomas').value.trim(),
    notas:          document.getElementById('ord-notas').value.trim(),
    arreglos:       arreglosTemp,
    usuario_id:     u?.id,
  };

  if (ordenEditId) {
    const ex = await dbGet('ordenes', ordenEditId);
    await dbUpdate('ordenes', { ...ex, ...data, id: ordenEditId });
    showToast('Orden actualizada', 'success');
  } else {
    await dbAdd('ordenes', data);
    showToast('Orden creada', 'success');
  }
  cerrarModal('modal-orden');
  cargarOrdenes();
  actualizarDashboard();
}

async function abrirModalArreglo(ordenId) {
  ordenArregloId = ordenId;
  document.getElementById('form-arreglo-existente').reset();
  const repuestos = await dbGetAll('repuestos');
  const sel = document.getElementById('are-repuesto');
  sel.innerHTML = '<option value="">— Sin repuesto —</option>' +
    repuestos.map(r=>`<option value="${r.id}" data-precio="${r.precio_venta}">${r.nombre} (Stock: ${r.stock})</option>`).join('');
  abrirModal('modal-arreglo-existente');
}

async function guardarArregloExistente() {
  const desc = document.getElementById('are-descripcion').value.trim();
  if (!desc) { showToast('Descripción requerida','error'); return; }
  const orden      = await dbGet('ordenes', ordenArregloId);
  const repuestoId = document.getElementById('are-repuesto').value;
  let repuestos    = [];
  if (repuestoId) {
    const cant = parseFloat(document.getElementById('are-cantidad').value)||1;
    const rep  = await dbGet('repuestos', parseInt(repuestoId));
    repuestos.push({ repuestoId: rep.id, nombre: rep.nombre, cantidad: cant, precio: rep.precio_venta });
    await dbUpdate('repuestos', { ...rep, stock: (rep.stock||0) - cant });
  }
  if (!orden.arreglos) orden.arreglos = [];
  orden.arreglos.push({
    descripcion: desc,
    manoObra:    parseFloat(document.getElementById('are-mano-obra').value)||0,
    notas:       document.getElementById('are-notas').value.trim(),
    estado:      'en_proceso', repuestos,
  });
  await dbUpdate('ordenes', orden);
  cerrarModal('modal-arreglo-existente');
  cargarOrdenes();
  showToast('Arreglo agregado', 'success');
}

async function abrirDetalleOrden(id) {
  // Abre la vista lista y expande la orden
  toggleVistaOrdenes('lista');
  await cargarOrdenes();
  setTimeout(() => {
    const body = document.getElementById(`orden-body-${id}`);
    if (body) body.style.display = 'block';
  }, 300);
}

async function eliminarOrden(id) {
  if (!await confirmar('¿Eliminar esta orden? Esta acción no se puede deshacer.')) return;
  await dbDelete('ordenes', id);
  showToast('Orden eliminada','info');
  cargarOrdenes();
  actualizarDashboard();
}
