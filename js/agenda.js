
async function cargarVehiculosClienteTurno(clienteId) {
  const sel = document.getElementById('turno-vehiculo-sel');
  if (!sel) return;

  if (!clienteId) {
    sel.innerHTML = '<option value="">— Seleccionar vehículo (opcional) —</option>';
    sel.style.display = 'none';
    return;
  }

  const vehiculos = await dbGetAll('vehiculos');
  const misVeh = vehiculos.filter(v => v.cliente_id === parseInt(clienteId));

  if (!misVeh.length) {
    sel.innerHTML = '<option value="">— Sin vehículos registrados —</option>';
    sel.style.display = 'block';
    return;
  }

  sel.innerHTML = '<option value="">— Seleccionar vehículo —</option>' +
    misVeh.map(v => `<option value="${v.id}" 
      data-marca="${v.marca||''}" 
      data-modelo="${v.modelo||''}" 
      data-anio="${v.anio||''}"
      data-placa="${v.placa||''}"
      data-color="${v.color||''}"
      data-vin="${v.vin||''}"
      data-tipo="${v.tipo||'sedan'}">
      ${v.marca} ${v.modelo} ${v.anio||''} · ${v.placa||''}
    </option>`).join('');
  sel.style.display = 'block';
}

function autocompletarVehiculoTurno(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt?.value) return;

  // Llenar campos del vehículo
  const fields = {
    'turno-marca':   opt.dataset.marca,
    'turno-modelo':  opt.dataset.modelo,
    'turno-anio':    opt.dataset.anio,
    'turno-placa':   opt.dataset.placa,
    'turno-color':   opt.dataset.color,
    'turno-vin':     opt.dataset.vin,
    'turno-tipo-veh':opt.dataset.tipo,
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  });
}

function onClienteTurnoChange(sel) {
  // Si seleccionó cliente registrado, cargar sus vehículos
  if (sel.value) {
    document.getElementById('turno-cliente-libre').value = '';
    cargarVehiculosClienteTurno(sel.value);
  } else {
    const selVeh = document.getElementById('turno-vehiculo-sel');
    if (selVeh) selVeh.style.display = 'none';
  }
}

// ---- FOTOS DEL VEHÍCULO ----
let fotosBase64 = [];

function previewFotos(input) {
  fotosBase64 = [];
  const preview = document.getElementById('turno-fotos-preview');
  preview.innerHTML = '';

  const files = Array.from(input.files);
  if (!files.length) {
    preview.innerHTML = '<p class="text-muted text-sm">📷 Toca para agregar fotos</p>';
    return;
  }

  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = e => {
      fotosBase64.push(e.target.result);
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid var(--border);cursor:pointer';
      img.title = 'Click para eliminar';
      img.onclick = () => {
        fotosBase64.splice(idx, 1);
        img.remove();
      };
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}
// ============================================================
// AGENDA.JS — Turnos y gestión de capacidad diaria
// ============================================================

async function cargarAgenda(fecha = null) {
  const hoy = fecha || new Date().toISOString().split('T')[0];
  document.getElementById('agenda-fecha').value = hoy;

  // Cargar turnos del día
  const turnos = await dbGetAll('agenda');
  const turnosDia = turnos.filter(t => t.fecha === hoy)
                          .sort((a,b) => a.hora.localeCompare(b.hora));

  // Capacidad
  const capacidadMax = parseInt(await getConfig('agenda_capacidad') || '5');
  const ocupados = turnosDia.filter(t => t.estado !== 'cancelado').length;
  const disponibles = Math.max(0, capacidadMax - ocupados);

  // Update capacity display
  document.getElementById('agenda-ocupados').textContent = ocupados;
  document.getElementById('agenda-disponibles').textContent = disponibles;
  document.getElementById('agenda-max').textContent = capacidadMax;

  // Progress bar
  const pct = capacidadMax > 0 ? Math.min(100, Math.round((ocupados/capacidadMax)*100)) : 0;
  const bar = document.getElementById('agenda-progress');
  if (bar) {
    bar.style.width = pct + '%';
    bar.style.background = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#009EED';
  }

  // Render turnos
  const lista = document.getElementById('agenda-lista');
  if (!turnosDia.length) {
    lista.innerHTML = `<div class="empty-state"><div class="ico">📅</div><h3>Sin turnos para este día</h3><p>Agrega el primer turno del día</p></div>`;
    return;
  }

  lista.innerHTML = turnosDia.map(t => `
    <div class="orden-card" style="margin-bottom:8px">
      <div class="orden-header" style="cursor:default">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="background:var(--red-dim);border-radius:8px;padding:10px 14px;text-align:center;min-width:60px;flex-shrink:0">
            <div style="font-size:1.1rem;font-weight:700;color:var(--red);font-family:monospace">${t.hora}</div>
          </div>
          <div class="orden-info">
            <h4>${t.cliente_nombre || 'Cliente sin registrar'}</h4>
            <p>🚗 ${t.vehiculo_desc || '—'} · 🔧 ${t.servicio || 'Servicio general'}</p>
            ${t.notas ? `<p style="color:var(--text2);font-size:0.7rem">📝 ${t.notas}</p>` : ''}
          </div>
        </div>
        <div class="orden-meta">
          ${badgeTurno(t.estado)}
          <button class="btn btn-xs btn-ghost" onclick="cambiarEstadoTurno(${t.id}, '${t.estado}')">✏️</button>
          <button class="btn btn-xs btn-danger" onclick="eliminarTurno(${t.id})">🗑️</button>
          ${t.estado === 'confirmado' ? `<button class="btn btn-xs btn-primary" onclick="crearOrdenDesdeTurno(${t.id})">📝 Crear Orden</button>` : ''}
        </div>
      </div>
    </div>`).join('');
}

function badgeTurno(estado) {
  const map = {
    pendiente:   '<span class="badge badge-yellow">⏳ Pendiente</span>',
    confirmado:  '<span class="badge badge-blue">✅ Confirmado</span>',
    en_taller:   '<span class="badge badge-yellow">🔧 En Taller</span>',
    completado:  '<span class="badge badge-green">✅ Completado</span>',
    cancelado:   '<span class="badge badge-red">❌ Cancelado</span>',
  };
  return map[estado] || `<span class="badge badge-gray">${estado}</span>`;
}

async function cambiarEstadoTurno(id, estadoActual) {
  const estados = ['pendiente','confirmado','en_taller','completado','cancelado'];
  const idx = estados.indexOf(estadoActual);
  const siguiente = estados[(idx + 1) % estados.length];
  const turno = await dbGet('agenda', id);
  await dbUpdate('agenda', { ...turno, estado: siguiente });
  cargarAgenda(document.getElementById('agenda-fecha').value);
  showToast('Estado actualizado', 'success');
}

async function eliminarTurno(id) {
  if (!await confirmar('¿Eliminar este turno?')) return;
  await dbDelete('agenda', id);
  cargarAgenda(document.getElementById('agenda-fecha').value);
  showToast('Turno eliminado', 'info');
}

// Modal nuevo turno
let turnoEditId = null;

async function abrirModalTurno(id = null) {
  turnoEditId = id;
  document.getElementById('turno-modal-titulo').textContent = id ? 'Editar Turno' : 'Nuevo Turno';
  document.querySelectorAll('#form-turno input, #form-turno select, #form-turno textarea').forEach(el => { if(el.type !== 'checkbox') el.value = ''; else el.checked = false; });
  document.getElementById('turno-fecha').value = document.getElementById('agenda-fecha')?.value || new Date().toISOString().split('T')[0];

  await poblarSelectClienteTurno();

  if (id) {
    const t = await dbGet('agenda', id);
    document.getElementById('turno-fecha').value   = t.fecha || '';
    document.getElementById('turno-hora').value    = t.hora || '';
    document.getElementById('turno-cliente').value = t.cliente_id || '';
    document.getElementById('turno-cliente-libre').value = t.cliente_nombre || '';
    document.getElementById('turno-telefono').value = t.cliente_telefono || '';
    document.getElementById('turno-email').value    = t.cliente_email || '';
    document.getElementById('turno-marca').value    = t.vehiculo_marca || '';
    document.getElementById('turno-modelo').value   = t.vehiculo_modelo || '';
    document.getElementById('turno-anio').value     = t.vehiculo_anio || '';
    document.getElementById('turno-color').value    = t.vehiculo_color || '';
    document.getElementById('turno-placa').value    = t.vehiculo_placa || '';
    document.getElementById('turno-vin').value      = t.vehiculo_vin || '';
    document.getElementById('turno-km').value       = t.vehiculo_km || '';
    document.getElementById('turno-servicio').value = t.servicio || '';
    document.getElementById('turno-duracion').value = t.duracion || '60';
    document.getElementById('turno-notas').value    = t.notas || '';
    document.getElementById('turno-estado').value   = t.estado || 'pendiente';
    // Mostrar fotos guardadas
    if (t.fotos) {
      try {
        fotosBase64 = JSON.parse(t.fotos);
        const prev = document.getElementById('turno-fotos-preview');
        if (prev) {
          prev.innerHTML = '';
          fotosBase64.forEach((src, idx) => {
            const img = document.createElement('img');
            img.src = src;
            img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid var(--border)';
            prev.appendChild(img);
          });
        }
      } catch(e) {}
    }
  }

  abrirModal('modal-turno');
}

async function poblarSelectClienteTurno() {
  const clientes = await dbGetAll('clientes');
  const sel = document.getElementById('turno-cliente');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Cliente (opcional) —</option>' +
    clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

async function guardarTurno() {
  const fecha    = document.getElementById('turno-fecha').value;
  const hora     = document.getElementById('turno-hora').value;
  const clienteId= document.getElementById('turno-cliente').value;
  const servicio = document.getElementById('turno-servicio').value.trim();

  if (!fecha || !hora) { showToast('Fecha y hora son requeridas', 'error'); return; }

  let clienteNombre = '';
  if (clienteId) {
    const cli = await dbGet('clientes', parseInt(clienteId));
    clienteNombre = cli?.nombre || '';
  } else {
    clienteNombre = document.getElementById('turno-cliente-libre')?.value.trim() || 'Sin registrar';
  }

  const marca  = document.getElementById('turno-marca')?.value.trim() || '';
  const modelo = document.getElementById('turno-modelo')?.value.trim() || '';
  const anio   = document.getElementById('turno-anio')?.value.trim() || '';
  const placa  = document.getElementById('turno-placa')?.value.trim().toUpperCase() || '';
  const vehiculoDesc = [marca, modelo, anio, placa ? '· '+placa : ''].filter(Boolean).join(' ');

  const data = {
    fecha,
    hora,
    cliente_id:     clienteId ? parseInt(clienteId) : null,
    cliente_nombre: clienteNombre,
    cliente_telefono: document.getElementById('turno-telefono')?.value.trim() || '',
    cliente_email:    document.getElementById('turno-email')?.value.trim() || '',
    vehiculo_desc:  vehiculoDesc || document.getElementById('turno-vehiculo-desc')?.value.trim() || '',
    vehiculo_marca: marca,
    vehiculo_modelo: modelo,
    vehiculo_anio:  anio,
    vehiculo_color: document.getElementById('turno-color')?.value.trim() || '',
    vehiculo_placa: placa,
    vehiculo_vin:   document.getElementById('turno-vin')?.value.trim() || '',
    vehiculo_km:    parseInt(document.getElementById('turno-km')?.value) || null,
    vehiculo_tipo:  document.getElementById('turno-tipo-veh')?.value || 'sedan',
    fotos:          fotosBase64.length ? JSON.stringify(fotosBase64) : null,
    servicio:       servicio || 'Servicio general',
    duracion:       parseInt(document.getElementById('turno-duracion').value) || 60,
    notas:          document.getElementById('turno-notas').value.trim(),
    estado:         document.getElementById('turno-estado').value || 'pendiente',
  };

  if (turnoEditId) {
    const ex = await dbGet('agenda', turnoEditId);
    await dbUpdate('agenda', { ...ex, ...data, id: turnoEditId });
    showToast('Turno actualizado', 'success');
  } else {
    await dbAdd('agenda', data);
    showToast('Turno agendado', 'success');
  }

  cerrarModal('modal-turno');
  cargarAgenda(fecha);
}

async function crearOrdenDesdeTurno(turnoId) {
  const turno = await dbGet('agenda', turnoId);
  if (!turno) return;

  // Navegar a órdenes y pre-llenar
  navegarA('ordenes');
  setTimeout(async () => {
    await abrirModalOrden();
    if (turno.cliente_id) {
      document.getElementById('ord-cliente').value = turno.cliente_id;
      await cargarVehiculosOrden(turno.cliente_id);
    }
    document.getElementById('ord-notas').value = `Turno ${turno.hora} - ${turno.servicio}`;
    // Marcar turno como en_taller
    await dbUpdate('agenda', { ...turno, estado: 'en_taller' });
  }, 400);
}

async function guardarCapacidadDiaria() {
  const cap = document.getElementById('agenda-cap-input')?.value;
  if (!cap) return;
  await setConfig('agenda_capacidad', cap);
  showToast('Capacidad actualizada', 'success');
  cargarAgenda(document.getElementById('agenda-fecha').value);
}

// Crear tabla agenda en Supabase si no existe (via JS check)
async function initAgenda() {
  try {
    await dbGetAll('agenda');
  } catch(e) {
    console.log('Tabla agenda no existe aún');
  }
}
