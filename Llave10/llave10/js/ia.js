// ============================================================
// IA.JS — Asistente de IA (Claude API)
// ============================================================

let iaHistorial = [];

async function enviarMensajeIA() {
  const input = document.getElementById('ia-input');
  const msg   = input.value.trim();
  if (!msg) return;

  input.value = '';
  agregarMensajeIA('user', msg);
  agregarMensajeIA('ai', '...pensando...', true);

  // Contexto del taller para la IA
  const [ordenes, repuestos] = await Promise.all([
    dbGetAll('ordenes').then(o => o.filter(x => x.estado_orden !== 'cerrado').slice(0,5)),
    dbGetAll('repuestos').then(r => r.filter(x => (x.stock||0) <= (x.stock_min||5)))
  ]);

  const contexto = `Eres el asistente técnico de Llave10, un sistema para talleres mecánicos.
Tienes acceso a esta información del taller:
- Órdenes activas: ${ordenes.length} (${ordenes.map(o=>o.vehiculo_marca+' '+o.vehiculo_modelo).join(', ')})
- Repuestos con stock bajo: ${repuestos.length} (${repuestos.map(r=>r.nombre).join(', ')})
Responde en español, de forma breve y práctica. Puedes ayudar con:
diagnósticos de vehículos, mantenimiento preventivo, checklists técnicos, recomendaciones de repuestos.`;

  iaHistorial.push({ role: 'user', content: msg });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: contexto,
        messages: iaHistorial.slice(-8), // últimos 8 turnos
      })
    });

    const data = await response.json();
    const respuesta = data.content?.[0]?.text || 'No pude procesar la respuesta.';
    iaHistorial.push({ role: 'assistant', content: respuesta });

    // Reemplazar "pensando..."
    const msgs = document.getElementById('ia-messages');
    const loading = msgs.querySelector('.loading');
    if (loading) loading.remove();
    agregarMensajeIA('ai', respuesta);

  } catch (err) {
    const msgs = document.getElementById('ia-messages');
    const loading = msgs.querySelector('.loading');
    if (loading) loading.remove();
    agregarMensajeIA('ai', '⚠️ Error al conectar con el asistente. Verifica la configuración de la API key en Settings → Asistente IA.');
  }
}

function agregarMensajeIA(rol, texto, loading = false) {
  const msgs = document.getElementById('ia-messages');
  const div  = document.createElement('div');
  div.className = `ia-msg ${rol}${loading ? ' loading' : ''}`;
  div.textContent = texto;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function limpiarChatIA() {
  iaHistorial = [];
  document.getElementById('ia-messages').innerHTML = `
    <div class="ia-msg ai">¡Hola! Soy el asistente técnico de Llave10. Puedo ayudarte con diagnósticos, checklists de mantenimiento y recomendaciones técnicas. ¿En qué puedo ayudarte?</div>`;
}

// Enter para enviar
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('ia-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensajeIA(); }
    });
  }
});

// Sugerencias rápidas
function sugerenciaIA(texto) {
  document.getElementById('ia-input').value = texto;
  enviarMensajeIA();
}
