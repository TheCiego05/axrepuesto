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
-- Configuración → Términos y Garantía dentro de la app).
insert into config (key, value)
values ('terminos_garantia',
  'Esta cotización tiene una validez de 15 días a partir de la fecha de envío. ' ||
  'Los precios incluyen mano de obra y repuestos descritos; cualquier hallazgo adicional durante el servicio será informado antes de proceder. ' ||
  'Garantizamos la mano de obra realizada por 30 días y los repuestos instalados según la garantía del fabricante. ' ||
  'La garantía no cubre daños por mal uso, accidentes o intervención de terceros posterior a la entrega del vehículo.')
on conflict (key) do nothing;
