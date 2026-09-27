-- =============================================================================
-- Sabor y Sazón — notificaciones push a recepción (RNF-02)
--
-- Cuando entra un pedido, la base le pide al servicio de Expo que mande una
-- notificación a cada celular de recepción registrado. Llega aunque la app
-- esté cerrada o el celular bloqueado.
--
-- Ejecutar en Supabase: SQL Editor → pegar este archivo → Run.
-- Requiere 0001_esquema.sql.
-- =============================================================================

-- pg_net hace pedidos HTTP desde Postgres. Se envían recién cuando se
-- confirma la transacción, así que crear un pedido no se demora.
create extension if not exists pg_net;

-- -----------------------------------------------------------------------------
-- Celulares de recepción que reciben avisos
-- -----------------------------------------------------------------------------
create table if not exists saborsazon.dispositivos_staff (
  token text primary key,                     -- ExponentPushToken[...]
  perfil_id uuid not null references saborsazon.perfiles (id) on delete cascade,
  plataforma text not null default 'android',
  actualizado_en timestamptz not null default now()
);

alter table saborsazon.dispositivos_staff enable row level security;
-- Sin políticas: solo se accede con las funciones de abajo.

-- Al iniciar sesión. Si el celular ya estaba con otro usuario, pasa al nuevo.
create or replace function saborsazon.registrar_dispositivo(p_token text, p_plataforma text default 'android')
returns void
language plpgsql
security definer
set search_path = saborsazon
as $$
begin
  if not saborsazon.es_staff() then
    raise exception 'Solo recepción puede recibir avisos de pedidos.';
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Token de notificaciones inválido.';
  end if;

  insert into saborsazon.dispositivos_staff (token, perfil_id, plataforma)
  values (p_token, auth.uid(), coalesce(p_plataforma, 'android'))
  on conflict (token) do update
    set perfil_id = excluded.perfil_id,
        plataforma = excluded.plataforma,
        actualizado_en = now();
end;
$$;

-- Al cerrar sesión, para que ese celular deje de recibir avisos.
create or replace function saborsazon.quitar_dispositivo(p_token text)
returns void
language sql
security definer
set search_path = saborsazon
as $$
  delete from saborsazon.dispositivos_staff where token = p_token and perfil_id = auth.uid();
$$;

revoke execute on function saborsazon.registrar_dispositivo(text, text) from public, anon;
revoke execute on function saborsazon.quitar_dispositivo(text) from public, anon;
grant execute on function saborsazon.registrar_dispositivo(text, text) to authenticated;
grant execute on function saborsazon.quitar_dispositivo(text) to authenticated;
revoke all on saborsazon.dispositivos_staff from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Aviso al entrar un pedido
-- -----------------------------------------------------------------------------
create or replace function saborsazon.avisar_nuevo_pedido()
returns trigger
language plpgsql
security definer
set search_path = saborsazon
as $$
declare
  v_mensajes jsonb;
  v_total text := '$' || replace(to_char(new.total, 'FM999,999,999'), ',', '.');
  v_entrega text := case when new.metodo_entrega = 'delivery' then 'Delivery' else 'Retira en el local' end;
begin
  select jsonb_agg(jsonb_build_object(
    'to', d.token,
    'title', 'Nuevo pedido #' || new.numero,
    'body', new.nombre_cliente || ' · ' || v_total || ' · ' || v_entrega,
    'sound', 'nuevo_pedido.mp3',
    'channelId', 'pedidos',
    'priority', 'high',
    'data', jsonb_build_object('pedidoId', new.id, 'numero', new.numero)
  ))
  into v_mensajes
  from saborsazon.dispositivos_staff d
  join saborsazon.perfiles pf on pf.id = d.perfil_id
  where pf.rol in ('recepcionista', 'duena');

  if v_mensajes is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_mensajes,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end if;
  return new;
exception when others then
  -- Un problema con los avisos nunca tiene que impedir que entre un pedido.
  raise warning 'No se pudo enviar el aviso del pedido %: %', new.numero, sqlerrm;
  return new;
end;
$$;

drop trigger if exists pedidos_avisar on saborsazon.pedidos;
create trigger pedidos_avisar
  after insert on saborsazon.pedidos
  for each row execute function saborsazon.avisar_nuevo_pedido();
