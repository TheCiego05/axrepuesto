
function seleccionarMecanicoTurno(sel) {
  const idEl = document.getElementById('turno-mecanico-id');
  if (idEl) idEl.value = sel.value;
}

// Mantiene el turno de Agenda (y por lo tanto el parqueo) en sincronía
// con el estado real de la orden, sin importar por dónde se cambió el
// estado (Facturar, el desplegable de Órdenes, el panel lateral, etc.).
// Antes solo Facturar liberaba el espacio; cambiar el estado a
// "Entregado" desde Órdenes lo dejaba ocupado para siempre.
async function sincronizarTurnoDesdeOrden(ordenId, nuevoEstadoOrden) {
  const mapaEstados = { entregado: 'completado', en_taller: 'en_taller', cancelado: 'cancelado' };
  const nuevoEstadoTurno = mapaEstados[nuevoEstadoOrden];
  if (!nuevoEstadoTurno) return;

  try {
    const { data: turnos } = await getClient().from('agenda').select('*').eq('orden_id', ordenId);
    for (const turno of (turnos || [])) {
      if (turno.estado === nuevoEstadoTurno) continue;
      const cambios = { estado: nuevoEstadoTurno };
      if (nuevoEstadoTurno === 'en_taller' && !turno.en_taller_desde) {
        cambios.en_taller_desde = new Date().toISOString();
      }
      await getClient().from('agenda').update(cambios).eq('id', turno.id);
    }
  } catch(e) {
    console.error('Error sincronizando turno con orden:', e);
  }
}

// ---- VISTA PARQUEO ----
let agendaViewActual = 'parqueo';

function switchAgendaView(view) {
  agendaViewActual = view;
  document.getElementById('agenda-view-parqueo').style.display = view === 'parqueo' ? 'block' : 'none';
  document.getElementById('agenda-view-lista').style.display   = view === 'lista'   ? 'block' : 'none';
  document.querySelectorAll('#agenda-view-tabs .tab-btn').forEach((b,i) => {
    b.classList.toggle('active', (i===0 && view==='parqueo') || (i===1 && view==='lista'));
  });
}

async function renderParqueo(turnos, capacidadMax) {
  const grid = document.getElementById('parqueo-grid');
  if (!grid) return;

  // El parqueo representa capacidad física real: solo vehículos que ya
  // están en el taller (en_taller). Una cita pendiente o confirmada que
  // todavía no ha llegado no ocupa un espacio — eso se ve en Vista Lista.
  const turnosActivos = turnos.filter(t => t.estado === 'en_taller');
  const espacios = [];

  // Fill occupied spaces
  for (let i = 0; i < capacidadMax; i++) {
    const turno = turnosActivos[i] || null;
    espacios.push(turno);
  }

  grid.innerHTML = espacios.map((t, i) => {
    const ocupado = !!t;
    const color = ocupado
      ? (t.estado === 'completado' ? '#16a34a' : t.estado === 'en_taller' ? '#009EED' : '#f59e0b')
      : null;

    return `
      <div onclick="${ocupado ? `verTurnoParqueo(${t?.id})` : `abrirModalTurno()`}"
        style="
          background:${ocupado ? 'var(--bg2)' : 'var(--bg3)'};
          border:2px ${ocupado ? 'solid' : 'dashed'} ${ocupado ? color : 'var(--border2)'};
          border-radius:12px;
          padding:14px 10px;
          text-align:center;
          cursor:pointer;
          transition:all 0.2s;
          min-height:140px;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:6px;
          position:relative;
        "
        onmouseover="this.style.transform='translateY(-2px)'"
        onmouseout="this.style.transform=''"
      >
        <div style="font-size:0.6rem;color:var(--text2);font-weight:700;position:absolute;top:6px;left:8px">
          #${i + 1}
        </div>

        ${ocupado ? `
          ${iconoVehiculoBadge(t.vehiculo_tipo, color)}

          <div style="font-size:0.72rem;font-weight:700;color:var(--text);margin-top:2px">
            ${t.vehiculo_placa || t.vehiculo_marca || 'Vehículo'}
          </div>
          <div style="font-size:0.65rem;color:var(--text2);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${t.cliente_nombre || 'Cliente'}
          </div>
          <div style="font-size:0.62rem;font-weight:700;color:${color};margin-top:2px">
            ${t.hora || ''}
          </div>
          <span style="
            background:${color}22;
            color:${color};
            border:1px solid ${color}44;
            border-radius:10px;
            padding:2px 8px;
            font-size:0.58rem;
            font-weight:700;
          ">🔧 Trabajando</span>
          ${t.en_taller_desde ? `<span style="font-size:0.58rem;color:var(--text3)">⏱ ${tiempoTranscurrido(t.en_taller_desde)}</span>` : ''}
        ` : `
          <!-- Espacio vacío -->
          ${iconoVehiculoBadge(null, '#8a97a8')}
          <div style="font-size:0.72rem;color:var(--text2);margin-top:4px">Disponible</div>
          <div style="font-size:0.65rem;color:var(--text3)">Toca para agendar</div>
        `}
      </div>`;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Tiempo transcurrido desde que un vehículo entró a "en_taller",
// en formato corto (ej. "45min", "2h 10min").
function tiempoTranscurrido(desdeIso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(desdeIso).getTime()) / 60000));
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

// Refrescar el parqueo cada minuto mientras la página de Agenda esté
// activa, para que el tiempo "trabajando" se mantenga al día sin recargar.
setInterval(() => {
  const pagina = document.getElementById('page-agenda');
  if (pagina?.classList.contains('active') && agendaViewActual === 'parqueo') {
    cargarAgenda(document.getElementById('agenda-fecha')?.value);
  }
}, 60000);

// ---- ÍCONO DE VEHÍCULO (badge redondeado, por tipo) ----
// Usa los íconos Lucide que ya carga el resto de la app (misma familia
// visual que el sidebar y las tarjetas), en vez de dibujar carros a mano.
function iconoVehiculoTipo(tipo) {
  const map = {
    sedan: 'car', hatchback: 'car', otro: 'car',
    suv: 'car-front', pickup: 'truck', camion: 'truck',
    minivan: 'bus', moto: 'bike',
  };
  return map[tipo] || 'car';
}

function iconoVehiculoBadge(tipo, color) {
  return `
    <div style="
      width:56px;height:56px;border-radius:14px;flex-shrink:0;
      background:${color}18;border:1px solid ${color}40;
      display:flex;align-items:center;justify-content:center;
    ">
      <i data-lucide="${iconoVehiculoTipo(tipo)}" style="width:28px;height:28px;stroke:${color};stroke-width:1.7"></i>
    </div>`;
}

function verTurnoParqueo(id) {
  // Abrir modal de edición del turno
  abrirModalTurno(id);
}

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

// Fotos de fotos de celular pueden pesar varios MB sin comprimir; las
// reducimos a un JPEG liviano antes de guardarlas en base64, si no la
// petición a Supabase puede fallar o el registro queda enorme.
const FOTO_MAX_DIM   = 1280;
const FOTO_CALIDAD   = 0.72;
const FOTO_MAX_COUNT = 6;

function comprimirImagen(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > FOTO_MAX_DIM || height > FOTO_MAX_DIM) {
          const ratio = Math.min(FOTO_MAX_DIM / width, FOTO_MAX_DIM / height);
          width  = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', FOTO_CALIDAD));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

async function previewFotos(input) {
  const files = Array.from(input.files);
  if (!files.length) return;

  if (fotosBase64.length + files.length > FOTO_MAX_COUNT) {
    showToast(`Máximo ${FOTO_MAX_COUNT} fotos por turno`, 'error');
    input.value = '';
    return;
  }

  // Se procesan en orden (no en paralelo) para que el índice de cada foto
  // en fotosBase64 sea predecible y "eliminar" borre la correcta.
  for (const file of files) {
    try {
      fotosBase64.push(await comprimirImagen(file));
    } catch(e) {
      console.error('Error procesando foto:', e);
      showToast('No se pudo procesar una de las fotos', 'error');
    }
  }
  input.value = ''; // permite volver a seleccionar el mismo archivo después
  renderFotosPreview();
}

function renderFotosPreview() {
  const preview = document.getElementById('turno-fotos-preview');
  if (!preview) return;
  if (!fotosBase64.length) {
    preview.innerHTML = '<p class="text-muted text-sm">📷 Toca para agregar fotos</p>';
    return;
  }
  preview.innerHTML = fotosBase64.map((src, i) => `
    <img src="${src}" title="Click para eliminar" onclick="eliminarFotoTurno(${i})"
      style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid var(--border);cursor:pointer">
  `).join('');
}

function eliminarFotoTurno(i) {
  fotosBase64.splice(i, 1);
  renderFotosPreview();
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

  // Capacidad: "ocupado" es un vehículo físicamente en el taller (en_taller),
  // no una cita agendada/confirmada que todavía no ha llegado. Una cosa es
  // el calendario de citas y otra la capacidad real del taller.
  const capacidadMax = parseInt(await getConfig('agenda_capacidad') || '5');
  const ocupados = turnosDia.filter(t => t.estado === 'en_taller').length;
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

  // Render parking view
  await renderParqueo(turnosDia, capacidadMax);

  // Render lista
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
  const cambios = { ...turno, estado: siguiente };
  if (siguiente === 'en_taller') cambios.en_taller_desde = new Date().toISOString();
  await dbUpdate('agenda', cambios);

  if (siguiente === 'confirmado') {
    await crearOrdenAutomaticaDesdeTurno({ ...turno, estado: siguiente });
    showToast('Turno confirmado — orden de trabajo creada', 'success');
  } else {
    showToast('Estado actualizado', 'success');
  }
  cargarAgenda(document.getElementById('agenda-fecha').value);
}

// Crea (una sola vez) la orden de trabajo ligada a un turno confirmado.
// Si el turno ya tiene orden_id, no duplica nada.
async function crearOrdenAutomaticaDesdeTurno(turno) {
  if (turno.orden_id) return turno.orden_id;

  const data = {
    cliente_id:      turno.cliente_id || null,
    cliente_nombre:  turno.cliente_nombre || 'Cliente sin registrar',
    vehiculo_placa:  turno.vehiculo_placa || '',
    vehiculo_marca:  turno.vehiculo_marca || '',
    vehiculo_modelo: turno.vehiculo_modelo || '',
    mecanico_id:     turno.mecanico_id || null,
    mecanico:        turno.mecanico_nombre || '',
    estado_orden:    'recibido',
    prioridad:       'normal',
    kilometraje:     turno.vehiculo_km || null,
    notas:           `Generada desde Agenda · turno ${formatDate(turno.fecha)} ${turno.hora||''}`.trim(),
    arreglos: [{
      descripcion:     turno.servicio || 'Servicio general',
      manoObra:        0,
      estado:          'en_proceso',
      repuestos:       [],
      mecanico_id:     turno.mecanico_id || null,
      mecanico_nombre: turno.mecanico_nombre || '',
    }],
  };

  const ordenId = await dbAdd('ordenes', data);
  await dbUpdate('agenda', { ...turno, orden_id: ordenId });
  if (typeof actualizarDashboard === 'function') actualizarDashboard();
  return ordenId;
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
  // Cargar mecánicos en el selector del turno
  if (typeof poblarSelectsMecanicos === 'function') {
    await poblarSelectsMecanicos();
  }

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
    // Restaurar mecánico seleccionado
    if (t.mecanico_id) {
      setTimeout(() => {
        const mecSel = document.getElementById('turno-mecanico');
        if (mecSel) mecSel.value = t.mecanico_id;
        const mecIdEl = document.getElementById('turno-mecanico-id');
        if (mecIdEl) mecIdEl.value = t.mecanico_id;
      }, 300);
    }
    // Mostrar fotos guardadas (con opción de eliminarlas)
    try { fotosBase64 = t.fotos ? JSON.parse(t.fotos) : []; } catch(e) { fotosBase64 = []; }
    renderFotosPreview();
  } else {
    fotosBase64 = [];
    renderFotosPreview();
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
    mecanico_id:    parseInt(document.getElementById('turno-mecanico-id')?.value) || null,
    mecanico_nombre: (() => {
      const sel = document.getElementById('turno-mecanico');
      const opt = sel?.options[sel?.selectedIndex];
      return opt?.text?.split(' · ')[0] || '';
    })(),
  };

  let turno;
  if (turnoEditId) {
    const ex = await dbGet('agenda', turnoEditId);
    if (data.estado === 'en_taller' && ex.estado !== 'en_taller') {
      data.en_taller_desde = new Date().toISOString();
    }
    turno = { ...ex, ...data, id: turnoEditId };
    await dbUpdate('agenda', turno);
    showToast('Turno actualizado', 'success');
  } else {
    const nuevoId = await dbAdd('agenda', data);
    turno = { ...data, id: nuevoId };
    showToast('Turno agendado', 'success');
  }

  if (turno.estado === 'confirmado') {
    await crearOrdenAutomaticaDesdeTurno(turno);
  }

  cerrarModal('modal-turno');
  cargarAgenda(fecha);
}

// Botón manual "Crear Orden" (Vista Lista): si el turno confirmado ya
// generó su orden automáticamente, solo la abre; si no, la crea ahora.
async function crearOrdenDesdeTurno(turnoId) {
  const turno = await dbGet('agenda', turnoId);
  if (!turno) return;
  const ordenId = await crearOrdenAutomaticaDesdeTurno(turno);
  navegarA('ordenes');
  setTimeout(() => abrirPanelOrden(ordenId), 300);
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
