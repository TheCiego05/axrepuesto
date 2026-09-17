-- ============================================================
-- Migración: Cotización por WhatsApp con aprobación del cliente
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

alter table ordenes
  add column if not exists cotizacion_token         text,
  add column if not exists cotizacion_estado         text default 'sin_enviar', -- sin_enviar | pendiente | aceptada | rechazada
  add column if not exists cotizacion_terminos       text,
  add column if not exists cotizacion_enviada_en     timestamptz,
  add column if not exists cotizacion_respondida_en  timestamptz,
  add column if not exists cotizacion_firma_nombre   text,
  add column if not exists cotizacion_comentario     text;

create unique index if not exists ordenes_cotizacion_token_idx
  on ordenes (cotizacion_token)
  where cotizacion_token is not null;

-- Texto por defecto de términos y garantía (se puede editar luego en
-- Configuración → Términos y Garantía dentro de la app). {{TALLER}} se
-- reemplaza automáticamente por el nombre configurado del negocio al
-- momento de enviar cada cotización.
insert into config (key, value)
values ('terminos_garantia', $ttt$Políticas de Garantía

Las reparaciones realizadas por {{TALLER}} cuentan con garantía de 30 días o 2,000 Km, según lo que ocurra primero.

Las garantías de los repuestos, partes y piezas instaladas pueden variar según la calidad escogida por el cliente y la naturaleza de la pieza. En todos los casos, la garantía de repuestos está sujeta a la garantía ofrecida por el proveedor, importador o fabricante de la misma.

IMPORTANTE
• En todos los casos, los parámetros de las garantías serán tomados de la Orden de Servicio, la Factura, el Control de Calidad y cualquier otro documento elaborado por {{TALLER}} correspondiente al vehículo en cuestión.
• Las garantías serán cubiertas siempre y cuando la naturaleza de la falla sea algún defecto de fábrica de las piezas instaladas, error humano en la reparación o causas atribuibles a {{TALLER}}.
• Toda garantía perderá validez en los casos en que se evidencie manipulación de carácter técnico del vehículo o la pieza en lapsos posteriores a la reparación efectuada.
• Toda garantía perderá validez en los casos en que las fallas sean atribuibles a situaciones externas como mal manejo, condiciones extremas, colisiones o cualquier otra situación que no sea atribuible a {{TALLER}}.
• Bajo ninguna circunstancia {{TALLER}} ofrece garantía por piezas, repuestos o partes que no hayan sido vendidas e instaladas por la organización, así como tampoco por ningún daño colateral que estas ocasionen.
• La garantía de todo servicio o pieza cubrirá la mano de obra y el reemplazo de la pieza en condiciones de uso normal. Bajo ninguna circunstancia {{TALLER}} cubrirá garantía por daños causados debido a procedimientos inadecuados, uso indebido o uso continuo del vehículo en períodos posteriores a la situación que la ocasione. Si el cliente observa elementos que indiquen algún defecto en la pieza instalada o la reparación, está en el deber de detener el uso del vehículo de inmediato y notificar a {{TALLER}} para dar inicio al proceso de garantía. De lo contrario, todo daño colateral será responsabilidad del usuario.

EXCEPCIONES
Según la naturaleza de la reparación efectuada, {{TALLER}} se encuentra en la facultad de ofrecer garantías por períodos y kilometrajes distintos a los establecidos anteriormente.

1. Trabajos de conservación (polichado, alineación, balanceo, etc.): por su naturaleza y factores externos, no aplica garantía.
2. Los trabajos de electricidad se garantizan por 5 días por su naturaleza. Las partes o piezas eléctricas NO tienen garantía bajo ninguna circunstancia.
3. Piezas reconstruidas o reparadas se garantizan por 15 días o 1,000 Km, lo que ocurra primero.
4. La reclamación de la garantía únicamente será atendida en las instalaciones de {{TALLER}} y deberá ser presentada ante un funcionario de {{TALLER}}.
5. Los términos de garantía, bajo ninguna circunstancia, amparan daños a terceros: lesiones o muerte causadas a los ocupantes del vehículo o a terceros, gastos de remolque, transporte, hotel, comunicaciones, lucro cesante y/o daño emergente.$ttt$)
on conflict (key) do update set value = excluded.value;
