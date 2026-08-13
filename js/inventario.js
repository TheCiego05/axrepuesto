// ============================================================
// INVENTARIO.JS
// ============================================================
let repuestoEditId = null;

async function cargarInventario(busqueda = '') {
  const todos = await dbGetAll('repuestos');
  const filtrados = todos.filter(r =>
    !busqueda ||
    r.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    r.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    r.categoria?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const tbody = document.getElementById('inventario-tbody');
  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="ico">📦</div><h3>Sin repuestos</h3><p>Agrega tu primer repuesto al inventario</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(r => {
    const bajo = (r.stock || 0) <= (r.stockMin || 5);
    return `
    <tr>
      <td class="mono text-sm">${r.codigo || '—'}</td>
      <td><strong>${r.nombre}</strong>${bajo ? ' <span class="badge badge-red">⚠️ Bajo</span>' : ''}</td>
      <td class="text-sm text-muted">${r.categoria || '—'}</td>
      <td class="text-sm">${r.ubicacion || '—'}</td>
      <td class="mono text-sm">${r.stock || 0}</td>
      <td class="mono text-sm">${formatMoney(r.precioCosto)}</td>
      <td class="mono text-sm">${formatMoney(r.precioVenta)}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-xs btn-green" onclick="ajustarStock(${r.id})">📦</button>
          <button class="btn btn-xs btn-ghost" onclick="editarRepuesto(${r.id})">✏️</button>
          <button class="btn btn-xs btn-danger" onclick="eliminarRepuesto(${r.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function abrirModalRepuesto(id = null) {
  repuestoEditId = id;
  document.getElementById('modal-repuesto-titulo').textContent = id ? 'Editar Repuesto' : 'Nuevo Repuesto';
  document.getElementById('form-repuesto').reset();
  if (!id) { abrirModal('modal-repuesto'); return; }
  dbGet('repuestos', id).then(r => {
    document.getElementById('rep-codigo').value = r.codigo || '';
    document.getElementById('rep-nombre').value = r.nombre || '';
    document.getElementById('rep-categoria').value = r.categoria || '';
    document.getElementById('rep-ubicacion').value = r.ubicacion || '';
    document.getElementById('rep-stock').value = r.stock || 0;
    document.getElementById('rep-stockmin').value = r.stockMin || 5;
    document.getElementById('rep-costo').value = r.precioCosto || 0;
    document.getElementById('rep-venta').value = r.precioVenta || 0;
    document.getElementById('rep-notas').value = r.notas || '';
    abrirModal('modal-repuesto');
  });
}

async function guardarRepuesto() {
  const data = {
    codigo:      document.getElementById('rep-codigo').value.trim(),
    nombre:      document.getElementById('rep-nombre').value.trim(),
    categoria:   document.getElementById('rep-categoria').value.trim(),
    ubicacion:   document.getElementById('rep-ubicacion').value.trim(),
    stock:       parseFloat(document.getElementById('rep-stock').value) || 0,
    stockMin:    parseFloat(document.getElementById('rep-stockmin').value) || 5,
    precioCosto: parseFloat(document.getElementById('rep-costo').value) || 0,
    precioVenta: parseFloat(document.getElementById('rep-venta').value) || 0,
    notas:       document.getElementById('rep-notas').value.trim(),
  };
  if (!data.nombre) { showToast('El nombre es requerido', 'error'); return; }
  if (repuestoEditId) {
    await dbUpdate('repuestos', { ...data, id: repuestoEditId });
    showToast('Repuesto actualizado', 'success');
  } else {
    await dbAdd('repuestos', data);
    showToast('Repuesto agregado', 'success');
  }
  cerrarModal('modal-repuesto');
  cargarInventario();
}

async function editarRepuesto(id) { abrirModalRepuesto(id); }

async function eliminarRepuesto(id) {
  if (!await confirmar('¿Eliminar este repuesto?')) return;
  await dbDelete('repuestos', id);
  showToast('Repuesto eliminado', 'info');
  cargarInventario();
}

async function ajustarStock(id) {
  const r = await dbGet('repuestos', id);
  const nuevo = prompt(`Stock actual de "${r.nombre}": ${r.stock}\nNuevo stock:`, r.stock);
  if (nuevo === null) return;
  const n = parseFloat(nuevo);
  if (isNaN(n)) { showToast('Cantidad inválida', 'error'); return; }
  await dbUpdate('repuestos', { ...r, stock: n });
  showToast('Stock actualizado', 'success');
  cargarInventario();
}
