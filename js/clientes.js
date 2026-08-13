// ============================================================
// CLIENTES.JS
// ============================================================
let clienteEditId = null;

async function cargarClientes(busqueda = '') {
  const todos = await dbGetAll('clientes');
  const filtrados = todos.filter(c =>
    !busqueda ||
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.cedula?.includes(busqueda) ||
    c.telefono?.includes(busqueda)
  );

  const tbody = document.getElementById('clientes-tbody');
  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="ico">👥</div><h3>No hay clientes</h3><p>Agrega tu primer cliente</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = filtrados.map(c => `
    <tr>
      <td><strong>${c.nombre}</strong></td>
      <td class="mono text-sm">${c.cedula || '—'}</td>
      <td>${c.telefono || '—'}</td>
      <td class="text-muted text-sm">${c.email || '—'}</td>
      <td class="text-muted text-sm">${c.direccion || '—'}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-xs btn-ghost" onclick="verVehiculos(${c.id})">🚗 Vehículos</button>
          <button class="btn btn-xs btn-ghost" onclick="editarCliente(${c.id})">✏️</button>
          <button class="btn btn-xs btn-danger" onclick="eliminarCliente(${c.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function abrirModalCliente(id = null) {
  clienteEditId = id;
  document.getElementById('modal-cliente-titulo').textContent = id ? 'Editar Cliente' : 'Nuevo Cliente';
  document.querySelectorAll('#form-cliente input, #form-cliente select, #form-cliente textarea').forEach(el => { if(el.type !== 'checkbox') el.value = ''; else el.checked = false; });
  if (!id) { abrirModal('modal-cliente'); return; }
  dbGet('clientes', id).then(c => {
    document.getElementById('cli-nombre').value = c.nombre || '';
    document.getElementById('cli-cedula').value = c.cedula || '';
    document.getElementById('cli-rnc').value = c.rnc || '';
    document.getElementById('cli-telefono').value = c.telefono || '';
    document.getElementById('cli-email').value = c.email || '';
    document.getElementById('cli-direccion').value = c.direccion || '';
    abrirModal('modal-cliente');
  });
}

async function guardarCliente() {
  const data = {
    nombre:    document.getElementById('cli-nombre').value.trim(),
    cedula:    document.getElementById('cli-cedula').value.trim(),
    rnc:       document.getElementById('cli-rnc').value.trim(),
    telefono:  document.getElementById('cli-telefono').value.trim(),
    email:     document.getElementById('cli-email').value.trim(),
    direccion: document.getElementById('cli-direccion').value.trim(),
  };
  if (!data.nombre) { showToast('El nombre es requerido', 'error'); return; }
  if (clienteEditId) {
    await dbUpdate('clientes', { ...data, id: clienteEditId });
    showToast('Cliente actualizado', 'success');
  } else {
    await dbAdd('clientes', data);
    showToast('Cliente agregado', 'success');
  }
  cerrarModal('modal-cliente');
  cargarClientes();
}

async function editarCliente(id) { abrirModalCliente(id); }

async function eliminarCliente(id) {
  if (!await confirmar('¿Eliminar este cliente?')) return;
  await dbDelete('clientes', id);
  showToast('Cliente eliminado', 'info');
  cargarClientes();
}

// ---- VEHÍCULOS ----
let vehiculoClienteId = null;
let vehiculoEditId = null;

async function verVehiculos(clienteId) {
  vehiculoClienteId = clienteId;
  const cliente = await dbGet('clientes', clienteId);
  document.getElementById('modal-vehiculos-titulo').textContent = `Vehículos de ${cliente.nombre}`;
  await cargarVehiculos(clienteId);
  abrirModal('modal-vehiculos');
}

async function cargarVehiculos(clienteId) {
  const vehiculos = await dbGetByIndex('vehiculos', 'clienteId', clienteId);
  const lista = document.getElementById('vehiculos-lista');
  if (!vehiculos.length) {
    lista.innerHTML = `<div class="empty-state"><div class="ico">🚗</div><h3>Sin vehículos</h3><p>Agrega un vehículo a este cliente</p></div>`;
    return;
  }
  lista.innerHTML = vehiculos.map(v => `
    <div class="arreglo-item">
      <div class="arreglo-desc">
        <strong>${v.marca} ${v.modelo} ${v.anio}</strong>
        <span>Placa: <span class="mono">${v.placa||'—'}</span> • Color: ${v.color||'—'} • VIN: ${v.vin||'—'}</span>
      </div>
      <div class="arreglo-actions">
        <button class="btn btn-xs btn-ghost" onclick="editarVehiculo(${v.id})">✏️</button>
        <button class="btn btn-xs btn-danger" onclick="eliminarVehiculo(${v.id})">🗑️</button>
      </div>
    </div>
  `).join('');
}

function abrirModalVehiculo(id = null) {
  vehiculoEditId = id;
  document.getElementById('modal-vehiculo-titulo').textContent = id ? 'Editar Vehículo' : 'Nuevo Vehículo';
  document.querySelectorAll('#form-vehiculo input, #form-vehiculo select, #form-vehiculo textarea').forEach(el => { if(el.type !== 'checkbox') el.value = ''; else el.checked = false; });
  if (!id) { abrirModal('modal-vehiculo'); return; }
  dbGet('vehiculos', id).then(v => {
    document.getElementById('veh-marca').value = v.marca || '';
    document.getElementById('veh-modelo').value = v.modelo || '';
    document.getElementById('veh-anio').value = v.anio || '';
    document.getElementById('veh-placa').value = v.placa || '';
    document.getElementById('veh-color').value = v.color || '';
    document.getElementById('veh-vin').value = v.vin || '';
    document.getElementById('veh-tipo').value = v.tipo || '';
    abrirModal('modal-vehiculo');
  });
}

async function guardarVehiculo() {
  const data = {
    clienteId: vehiculoClienteId,
    marca:  document.getElementById('veh-marca').value.trim(),
    modelo: document.getElementById('veh-modelo').value.trim(),
    anio:   document.getElementById('veh-anio').value.trim(),
    placa:  document.getElementById('veh-placa').value.trim().toUpperCase(),
    color:  document.getElementById('veh-color').value.trim(),
    vin:    document.getElementById('veh-vin').value.trim(),
    tipo:   document.getElementById('veh-tipo').value,
  };
  if (!data.marca || !data.modelo) { showToast('Marca y modelo son requeridos', 'error'); return; }
  if (vehiculoEditId) {
    await dbUpdate('vehiculos', { ...data, id: vehiculoEditId });
    showToast('Vehículo actualizado', 'success');
  } else {
    await dbAdd('vehiculos', data);
    showToast('Vehículo agregado', 'success');
  }
  cerrarModal('modal-vehiculo');
  cargarVehiculos(vehiculoClienteId);
}

async function editarVehiculo(id) { abrirModalVehiculo(id); }

async function eliminarVehiculo(id) {
  if (!await confirmar('¿Eliminar este vehículo?')) return;
  await dbDelete('vehiculos', id);
  showToast('Vehículo eliminado', 'info');
  cargarVehiculos(vehiculoClienteId);
}
