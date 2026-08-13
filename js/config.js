// ============================================================
// CONFIG.JS — Configuración del negocio y secuencias NCF/eCF
// ============================================================

const TIPOS_NCF = [
  // e-CF electrónico
  { tipo: 'e31', nombre: 'Crédito Fiscal',      formato: 'eCF',  prefijo: 'E31' },
  { tipo: 'e32', nombre: 'Consumidor Final',     formato: 'eCF',  prefijo: 'E32' },
  { tipo: 'e33', nombre: 'Nota de Débito',       formato: 'eCF',  prefijo: 'E33' },
  { tipo: 'e34', nombre: 'Nota de Crédito',      formato: 'eCF',  prefijo: 'E34' },
  // NCF físico
  { tipo: 'B01', nombre: 'Crédito Fiscal',       formato: 'NCF',  prefijo: 'B01' },
  { tipo: 'B02', nombre: 'Consumidor Final',      formato: 'NCF',  prefijo: 'B02' },
  { tipo: 'B03', nombre: 'Nota de Débito',        formato: 'NCF',  prefijo: 'B03' },
  { tipo: 'B04', nombre: 'Nota de Crédito',       formato: 'NCF',  prefijo: 'B04' },
  { tipo: 'B14', nombre: 'Régimen Especial',      formato: 'NCF',  prefijo: 'B14' },
  { tipo: 'B15', nombre: 'Gubernamental',         formato: 'NCF',  prefijo: 'B15' },
];

async function cargarConfig() {
  // Datos del negocio
  document.getElementById('cfg-nombre').value    = await getConfig('negocio_nombre') || '';
  document.getElementById('cfg-rnc').value       = await getConfig('negocio_rnc') || '';
  document.getElementById('cfg-telefono').value  = await getConfig('negocio_telefono') || '';
  document.getElementById('cfg-direccion').value = await getConfig('negocio_direccion') || '';
  document.getElementById('cfg-itbis').value     = await getConfig('itbis') || '18';

  await cargarSecuencias();
}

async function guardarConfigNegocio() {
  await setConfig('negocio_nombre', document.getElementById('cfg-nombre').value.trim());
  await setConfig('negocio_rnc', document.getElementById('cfg-rnc').value.trim());
  await setConfig('negocio_telefono', document.getElementById('cfg-telefono').value.trim());
  await setConfig('negocio_direccion', document.getElementById('cfg-direccion').value.trim());
  await setConfig('itbis', document.getElementById('cfg-itbis').value.trim());
  showToast('Configuración guardada', 'success');
}

// ---- SECUENCIAS ----
async function cargarSecuencias() {
  const secuencias = await dbGetAll('secuencias');
  const container = document.getElementById('secuencias-lista');

  // Agrupar por formato
  const eCF = secuencias.filter(s => s.formato === 'eCF');
  const NCF = secuencias.filter(s => s.formato === 'NCF');

  let html = '';

  if (eCF.length) {
    html += `<div class="nav-label" style="margin:12px 0 6px">📱 Comprobantes Electrónicos (e-CF)</div>`;
    html += eCF.map(s => renderSecuencia(s)).join('');
  }
  if (NCF.length) {
    html += `<div class="nav-label" style="margin:16px 0 6px">📄 NCF Físicos</div>`;
    html += NCF.map(s => renderSecuencia(s)).join('');
  }

  if (!secuencias.length) {
    html = `<div class="empty-state"><div class="ico">🔢</div><h3>Sin secuencias configuradas</h3><p>Agrega las secuencias que tienes disponibles de la DGII</p></div>`;
  }

  container.innerHTML = html;
}

function renderSecuencia(s) {
  const usados = s.actual - s.desde;
  const total = s.hasta - s.desde + 1;
  const pct = Math.min(100, Math.round((usados / total) * 100));
  const agotada = s.actual > s.hasta;
  const disponibles = Math.max(0, s.hasta - s.actual + 1);

  // Preview del próximo número
  let proxima = '—';
  if (!agotada) {
    if (s.tipo.startsWith('e')) {
      const cod = s.tipo.substring(1);
      proxima = 'E' + cod + String(s.actual).padStart(10, '0');
    } else {
      proxima = s.tipo + String(s.actual).padStart(8, '0');
    }
  }

  return `
  <div class="seq-card" style="${agotada ? 'opacity:0.5' : ''}">
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span class="badge ${s.formato==='eCF' ? 'badge-purple' : 'badge-blue'}">${s.formato}</span>
        <strong style="font-size:0.9rem">${s.nombre}</strong>
        ${agotada ? '<span class="badge badge-red">Agotada</span>' : s.activa ? '<span class="badge badge-green">Activa</span>' : '<span class="badge badge-gray">Inactiva</span>'}
      </div>
      <p class="mono text-xs text-muted">Rango: ${s.tipo}${String(s.desde).padStart(s.formato==='eCF'?10:8,'0')} → ${s.tipo}${String(s.hasta).padStart(s.formato==='eCF'?10:8,'0')}</p>
      <p class="mono text-xs text-muted">Próxima: <strong>${proxima}</strong> • Disponibles: ${disponibles}</p>
      <div class="progress-bar" style="margin-top:6px">
        <div class="progress-fill" style="width:${pct}%;background:${pct>90?'var(--red)':pct>70?'var(--yellow)':'var(--green)'}"></div>
      </div>
      <p class="text-xs text-muted" style="margin-top:2px">${usados} usados de ${total}</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
      <button class="btn btn-xs btn-ghost" onclick="editarSecuencia('${s.tipo}')">✏️ Editar</button>
      <button class="btn btn-xs btn-danger" onclick="eliminarSecuencia('${s.tipo}')">🗑️</button>
    </div>
  </div>`;
}

// ---- MODAL NUEVA SECUENCIA ----
let secuenciaEditTipo = null;

async function abrirModalSecuencia(tipo = null) {
  secuenciaEditTipo = tipo;
  document.getElementById('modal-seq-titulo').textContent = tipo ? 'Editar Secuencia' : 'Nueva Secuencia';
  document.getElementById('form-secuencia').reset();

  // Poblar select de tipos
  const existentes = await dbGetAll('secuencias');
  const existentesTipos = existentes.map(s => s.tipo);
  const sel = document.getElementById('seq-tipo');
  sel.innerHTML = TIPOS_NCF
    .filter(t => !tipo && !existentesTipos.includes(t.tipo) || t.tipo === tipo)
    .map(t => `<option value="${t.tipo}" data-formato="${t.formato}" data-nombre="${t.nombre}">[${t.formato}] ${t.tipo} — ${t.nombre}</option>`)
    .join('');

  if (tipo) {
    sel.disabled = true;
    const sec = await dbGet('secuencias', tipo);
    if (sec) {
      sel.value = tipo;
      document.getElementById('seq-desde').value = sec.desde;
      document.getElementById('seq-hasta').value = sec.hasta;
      document.getElementById('seq-activa').checked = sec.activa !== false;
    }
  } else {
    sel.disabled = false;
  }

  actualizarPreviewSecuencia();
  abrirModal('modal-secuencia');
}

function actualizarPreviewSecuencia() {
  const sel = document.getElementById('seq-tipo');
  const tipo = sel.value;
  const desde = document.getElementById('seq-desde').value;
  if (!tipo || !desde) { document.getElementById('seq-preview').textContent = '—'; return; }
  let preview;
  if (tipo.startsWith('e')) {
    preview = 'E' + tipo.substring(1) + String(desde).padStart(10, '0');
  } else {
    preview = tipo + String(desde).padStart(8, '0');
  }
  document.getElementById('seq-preview').textContent = preview;
}

async function editarSecuencia(tipo) { abrirModalSecuencia(tipo); }

async function guardarSecuencia() {
  const sel = document.getElementById('seq-tipo');
  const tipo = sel.value;
  if (!tipo) { showToast('Selecciona un tipo', 'error'); return; }

  const desde = parseInt(document.getElementById('seq-desde').value);
  const hasta = parseInt(document.getElementById('seq-hasta').value);
  if (!desde || !hasta || desde > hasta) { showToast('Rango inválido', 'error'); return; }

  const tipoInfo = TIPOS_NCF.find(t => t.tipo === tipo);
  const existente = await dbGet('secuencias', tipo);
  const data = {
    tipo,
    nombre: tipoInfo?.nombre || tipo,
    formato: tipoInfo?.formato || 'NCF',
    desde, hasta,
    actual: secuenciaEditTipo ? (existente?.actual || desde) : desde,
    activa: document.getElementById('seq-activa').checked,
  };

  await dbUpdate('secuencias', data);
  cerrarModal('modal-secuencia');
  showToast('Secuencia guardada', 'success');
  cargarSecuencias();
}

async function eliminarSecuencia(tipo) {
  if (!await confirmar('¿Eliminar esta secuencia? Se perderán los datos de rango configurado.')) return;
  await dbDelete('secuencias', tipo);
  showToast('Secuencia eliminada', 'info');
  cargarSecuencias();
}

// ============================================================
// DATOS DEMO
// ============================================================
const DEMO_CLIENTES = [
  { nombre:'Juan Carlos Pérez',   cedula:'001-1234567-8', telefono:'809-555-0101', email:'juan.perez@email.com',    direccion:'Calle Primera #12, Los Prados [DEMO]' },
  { nombre:'María Rodríguez',     cedula:'001-2345678-9', telefono:'829-555-0102', email:'maria.rodriguez@email.com',direccion:'Av. 27 de Febrero #45, Piantini [DEMO]' },
  { nombre:'Pedro Antonio Gómez', cedula:'001-3456789-0', telefono:'849-555-0103', email:'pedro.gomez@email.com',   direccion:'Calle Duarte #78, Santiago [DEMO]' },
  { nombre:'Ana Martínez López',  cedula:'001-4567890-1', telefono:'809-555-0104', email:'ana.martinez@email.com',  direccion:'Av. Independencia #33, SD [DEMO]' },
  { nombre:'Carlos Hernández',    cedula:'001-5678901-2', telefono:'829-555-0105', email:'carlos.h@email.com',      direccion:'Calle El Conde #21, Zona Colonial [DEMO]' },
  { nombre:'Laura Jiménez',       cedula:'001-6789012-3', telefono:'849-555-0106', email:'laura.j@email.com',       direccion:'Av. Churchill #89, Bella Vista [DEMO]' },
  { nombre:'Roberto Santos',      cedula:'001-7890123-4', telefono:'809-555-0107', email:'roberto.s@email.com',     direccion:'Calle Mella #56, Gazcue [DEMO]' },
  { nombre:'Diana Vargas',        cedula:'001-8901234-5', telefono:'829-555-0108', email:'diana.v@email.com',       direccion:'Av. Tiradentes #12, Naco [DEMO]' },
  { nombre:'Miguel Castillo',     cedula:'001-9012345-6', telefono:'849-555-0109', email:'miguel.c@email.com',      direccion:'Calle Las Flores #34, Arroyo Hondo [DEMO]' },
  { nombre:'Sofía Torres',        cedula:'001-0123456-7', telefono:'809-555-0110', email:'sofia.t@email.com',       direccion:'Av. Luperón #67, Villa Mella [DEMO]' },
];

const DEMO_VEHICULOS = [
  { marca:'Toyota',    modelo:'Corolla',   anio:'2019', placa:'A123456', color:'Plateado [DEMO]', tipo:'sedan' },
  { marca:'Honda',     modelo:'Civic',     anio:'2021', placa:'B234567', color:'Blanco [DEMO]',   tipo:'sedan' },
  { marca:'Nissan',    modelo:'Sentra',    anio:'2018', placa:'C345678', color:'Negro [DEMO]',     tipo:'sedan' },
  { marca:'Hyundai',   modelo:'Tucson',    anio:'2020', placa:'D456789', color:'Azul [DEMO]',      tipo:'suv' },
  { marca:'Kia',       modelo:'Sportage',  anio:'2022', placa:'E567890', color:'Rojo [DEMO]',      tipo:'suv' },
  { marca:'Ford',      modelo:'Explorer',  anio:'2019', placa:'F678901', color:'Gris [DEMO]',      tipo:'suv' },
  { marca:'Chevrolet', modelo:'Silverado', anio:'2021', placa:'G789012', color:'Negro [DEMO]',     tipo:'pickup' },
  { marca:'Toyota',    modelo:'RAV4',      anio:'2020', placa:'H890123', color:'Blanco [DEMO]',    tipo:'suv' },
  { marca:'Honda',     modelo:'CR-V',      anio:'2018', placa:'I901234', color:'Plateado [DEMO]',  tipo:'suv' },
  { marca:'Mazda',     modelo:'CX-5',      anio:'2022', placa:'J012345', color:'Rojo [DEMO]',      tipo:'suv' },
];

const DEMO_ORDENES = [
  { idx:0, mecanico:'Carlos Méndez',  estado_orden:'en_progreso',         prioridad:'alta',   sintomas:'Motor hace ruido al arrancar, humo por el escape',
    arreglos:[{descripcion:'Cambio de aceite y filtro',estado:'listo',manoObra:800,repuestos:[]},{descripcion:'Revisión de escape y empaque de cabeza',estado:'en_proceso',manoObra:2500,repuestos:[]},{descripcion:'Limpieza de inyectores',estado:'en_proceso',manoObra:1200,repuestos:[]}]},
  { idx:1, mecanico:'Luis Ramírez',   estado_orden:'en_diagnostico',      prioridad:'media',  sintomas:'Frenos hacen ruido, vibración en el volante',
    arreglos:[{descripcion:'Diagnóstico sistema de frenos',estado:'en_proceso',manoObra:500,repuestos:[]},{descripcion:'Balanceo y alineación',estado:'en_proceso',manoObra:900,repuestos:[]}]},
  { idx:2, mecanico:'Carlos Méndez',  estado_orden:'pendiente_aprobacion',prioridad:'normal', sintomas:'A/C no enfría, luz del motor encendida',
    arreglos:[{descripcion:'Recarga de gas refrigerante A/C',estado:'en_proceso',manoObra:1500,repuestos:[]},{descripcion:'Diagnóstico OBD2',estado:'en_proceso',manoObra:600,repuestos:[]}]},
  { idx:3, mecanico:'Pedro Sánchez',  estado_orden:'pendiente_pago',      prioridad:'normal', sintomas:'Batería descargada, revisión eléctrica',
    arreglos:[{descripcion:'Cambio de batería 65 Amp',estado:'listo',manoObra:400,repuestos:[]},{descripcion:'Revisión sistema eléctrico',estado:'listo',manoObra:800,repuestos:[]},{descripcion:'Cambio de alternador',estado:'listo',manoObra:2000,repuestos:[]}]},
  { idx:4, mecanico:'Luis Ramírez',   estado_orden:'cerrado',             prioridad:'normal', sintomas:'Mantenimiento preventivo 30,000 km',
    arreglos:[{descripcion:'Cambio aceite sintético 5W-30',estado:'listo',manoObra:600,repuestos:[]},{descripcion:'Cambio filtros',estado:'listo',manoObra:400,repuestos:[]},{descripcion:'Revisión frenos',estado:'listo',manoObra:500,repuestos:[]}]},
  { idx:5, mecanico:'Pedro Sánchez',  estado_orden:'en_progreso',         prioridad:'alta',   sintomas:'Transmisión resbalando, cambios bruscos',
    arreglos:[{descripcion:'Cambio aceite transmisión',estado:'listo',manoObra:1800,repuestos:[]},{descripcion:'Ajuste de transmisión',estado:'en_proceso',manoObra:3500,repuestos:[]}]},
  { idx:6, mecanico:'Carlos Méndez',  estado_orden:'borrador',            prioridad:'media',  sintomas:'Suspensión golpea en baches, dirección dura',
    arreglos:[{descripcion:'Cambio amortiguadores delanteros',estado:'en_proceso',manoObra:2200,repuestos:[]},{descripcion:'Revisión rótulas',estado:'en_proceso',manoObra:1000,repuestos:[]}]},
  { idx:7, mecanico:'Luis Ramírez',   estado_orden:'en_progreso',         prioridad:'media',  sintomas:'Check engine encendida, consumo alto',
    arreglos:[{descripcion:'Escaneo OBD2',estado:'listo',manoObra:500,repuestos:[]},{descripcion:'Cambio bujías y cables',estado:'listo',manoObra:1200,repuestos:[]},{descripcion:'Limpieza cuerpo aceleración',estado:'en_proceso',manoObra:800,repuestos:[]}]},
  { idx:8, mecanico:'Pedro Sánchez',  estado_orden:'pendiente_pago',      prioridad:'alta',   sintomas:'Accidente menor, parachoques y faro dañados',
    arreglos:[{descripcion:'Cambio parachoques delantero',estado:'listo',manoObra:2800,repuestos:[]},{descripcion:'Cambio faro delantero',estado:'listo',manoObra:600,repuestos:[]},{descripcion:'Pintura y acabado',estado:'listo',manoObra:3500,repuestos:[]}]},
  { idx:9, mecanico:'Carlos Méndez',  estado_orden:'en_diagnostico',      prioridad:'normal', sintomas:'Ruido al girar, vibración a alta velocidad',
    arreglos:[{descripcion:'Inspección dirección',estado:'en_proceso',manoObra:500,repuestos:[]},{descripcion:'Balanceo de ruedas',estado:'en_proceso',manoObra:600,repuestos:[]}]},
];

async function cargarDatosDemo() {
  const status = document.getElementById('demo-status');
  status.innerHTML = '⏳ Cargando datos demo...';

  try {
    // Verificar si ya existen
    const clientesExistentes = await dbGetAll('clientes');
    const demoExistentes = clientesExistentes.filter(c => c.direccion?.includes('[DEMO]'));
    if (demoExistentes.length > 0) {
      status.innerHTML = '⚠️ Los datos demo ya están cargados. Elimínalos primero si quieres recargarlos.';
      return;
    }

    // Insertar clientes
    status.innerHTML = '⏳ Creando clientes...';
    const clienteIds = [];
    for (const c of DEMO_CLIENTES) {
      const id = await dbAdd('clientes', c);
      clienteIds.push(id);
    }

    // Insertar vehículos
    status.innerHTML = '⏳ Creando vehículos...';
    const vehiculoIds = [];
    for (let i = 0; i < DEMO_VEHICULOS.length; i++) {
      const id = await dbAdd('vehiculos', { ...DEMO_VEHICULOS[i], cliente_id: clienteIds[i] });
      vehiculoIds.push(id);
    }

    // Insertar órdenes
    status.innerHTML = '⏳ Creando órdenes de trabajo...';
    for (const o of DEMO_ORDENES) {
      const cli = DEMO_CLIENTES[o.idx];
      const veh = DEMO_VEHICULOS[o.idx];
      await dbAdd('ordenes', {
        cliente_id:      clienteIds[o.idx],
        vehiculo_id:     vehiculoIds[o.idx],
        cliente_nombre:  cli.nombre,
        vehiculo_placa:  veh.placa,
        vehiculo_marca:  veh.marca,
        vehiculo_modelo: veh.modelo,
        mecanico:        o.mecanico,
        estado_orden:    o.estado_orden,
        prioridad:       o.prioridad,
        sintomas:        o.sintomas,
        notas:           'Orden de demostración [DEMO]',
        arreglos:        o.arreglos,
      });
    }

    status.innerHTML = '✅ <strong>Datos demo cargados:</strong> 10 clientes, 10 vehículos, 10 órdenes con diferentes estados.';
    showToast('¡Datos demo cargados exitosamente!', 'success');
    actualizarDashboard();

  } catch(err) {
    status.innerHTML = '❌ Error: ' + err.message;
    showToast('Error cargando datos demo', 'error');
  }
}

async function eliminarDatosDemo() {
  if (!await confirmar('¿Eliminar todos los datos de demostración? Esta acción no se puede deshacer.')) return;
  const status = document.getElementById('demo-status');
  status.innerHTML = '⏳ Eliminando datos demo...';

  try {
    // Eliminar órdenes demo
    const ordenes = await dbGetAll('ordenes');
    for (const o of ordenes.filter(o => o.notas?.includes('[DEMO]'))) {
      await dbDelete('ordenes', o.id);
    }
    // Eliminar vehículos demo
    const vehiculos = await dbGetAll('vehiculos');
    for (const v of vehiculos.filter(v => v.color?.includes('[DEMO]'))) {
      await dbDelete('vehiculos', v.id);
    }
    // Eliminar clientes demo
    const clientes = await dbGetAll('clientes');
    for (const c of clientes.filter(c => c.direccion?.includes('[DEMO]'))) {
      await dbDelete('clientes', c.id);
    }

    status.innerHTML = '✅ Datos demo eliminados correctamente.';
    showToast('Datos demo eliminados', 'info');
    actualizarDashboard();

  } catch(err) {
    status.innerHTML = '❌ Error: ' + err.message;
    showToast('Error eliminando datos demo', 'error');
  }
}
