-- ============================================================
-- Migración: Auth real de Supabase (reemplaza el login custom)
-- Ya aplicada en el proyecto vía MCP — este archivo es solo
-- referencia/historial, y sirve para replicar en otro ambiente.
-- ============================================================

-- 1. Enlazar usuarios.* con auth.users
alter table usuarios add column if not exists auth_user_id uuid unique;

-- 2. Función para que un super_admin/gerente cree usuarios nuevos con
--    cuenta real de Supabase Auth, sin manejar contraseñas desde el
--    cliente. El usuario nuevo recibe un correo de "recuperar
--    contraseña" para elegir la suya.
create or replace function crear_usuario_con_auth(p_email text, p_nombre text, p_rol_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_auth_id uuid;
  v_usuario_id bigint;
begin
  if not exists (
    select 1 from usuarios u join roles r on r.id = u.rol_id
    where u.auth_user_id = auth.uid() and r.nombre in ('super_admin','gerente') and u.activo = true
  ) then
    raise exception 'No tienes permisos para crear usuarios';
  end if;

  if exists (select 1 from auth.users where email = p_email) then
    raise exception 'Ya existe un usuario con ese correo';
  end if;

  v_auth_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', v_auth_id, 'authenticated', 'authenticated',
    p_email, crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre', p_nombre),
    now(), now(), '', '', '', '',
    false, false
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_auth_id, v_auth_id::text,
          jsonb_build_object('sub', v_auth_id::text, 'email', p_email),
          'email', now(), now(), now());

  insert into usuarios (nombre, email, rol_id, activo, auth_user_id)
  values (p_nombre, p_email, p_rol_id, true, v_auth_id)
  returning id into v_usuario_id;

  return v_usuario_id;
end;
$$;

revoke all on function crear_usuario_con_auth(text,text,bigint) from public;
revoke all on function crear_usuario_con_auth(text,text,bigint) from anon; -- Supabase otorga EXECUTE a anon/authenticated por defecto al crear funciones; revocar de PUBLIC no basta, hay que revocarlo de anon explícitamente.
grant execute on function crear_usuario_con_auth(text,text,bigint) to authenticated;

-- 3.1 Políticas RLS: deben cubrir el rol `authenticated`, no solo `anon`.
--     Si las políticas de tus tablas solo listan `{anon}` (revísalo con
--     `select tablename, roles from pg_policies where schemaname='public'`),
--     una vez que el login sea real, TODAS las peticiones autenticadas
--     quedarán bloqueadas (perfil, órdenes, clientes, etc. dejan de verse).
--     Ejemplo de arreglo para cada política existente:
--       alter policy acceso_usuarios on usuarios to public;
--     (repetir por cada tabla/política — "public" cubre anon + authenticated)

-- 3. Migración de usuarios existentes (ya ejecutada manualmente para
--    admin@llave10.com y p.santana@axentia.com.do): se crea la cuenta
--    en auth.users/auth.identities SIN contraseña utilizable, y cada
--    quien la establece por primera vez con "Olvidé mi contraseña".
--    No se incluye aquí el bloque exacto porque usa datos reales de
--    la tabla usuarios de este proyecto.

-- ============================================================
-- PENDIENTE (a propósito, no incluido en esta migración):
-- Las políticas RLS de todas las tablas siguen abiertas a `anon`
-- (acceso total sin sesión). Ahora que hay Auth real, el siguiente
-- paso de seguridad es restringir esas políticas a `authenticated`,
-- excepto en `ordenes` donde debe seguir permitiendo lectura/escritura
-- anónima LIMITADA para la página pública de cotización
-- (cotizacion.html). Ese cambio se hace aparte porque tiene riesgo
-- real de romper el acceso público a cotizaciones si no se ajusta
-- cotizacion.html en el mismo paso.
-- ============================================================
