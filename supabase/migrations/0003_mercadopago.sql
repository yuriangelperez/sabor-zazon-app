-- =============================================================================
-- Sabor y Sazón — pagos con Mercado Pago (tarjeta y link de pago)
--
-- Los pedidos con tarjeta o Mercado Pago nacen con el pago "pendiente": el
-- cliente paga en Mercado Pago (Checkout Pro) y recién cuando el pago se
-- aprueba el pedido le aparece a recepción y le llega el aviso.
-- El estado del pago lo actualizan las Edge Functions `mp-pago` y
-- `mp-webhook` (supabase/functions), que consultan a Mercado Pago.
--
-- Ejecutar en Supabase: SQL Editor → pegar este archivo → Run.
-- Requiere 0001_esquema.sql y 0002_notificaciones.sql.
-- =============================================================================

-- no_aplica: efectivo o transferencia (se cobra fuera de la app).
alter table saborsazon.pedidos
  add column if not exists pago_estado text not null default 'no_aplica'
    check (pago_estado in ('no_aplica', 'pendiente', 'aprobado', 'rechazado', 'reembolsado')),
  add column if not exists mp_preferencia_id text,
  add column if not exists mp_pago_id text,
  add column if not exists pago_actualizado_en timestamptz;

create index if not exists pedidos_pago_estado_idx on saborsazon.pedidos (pago_estado);

-- Todo pedido nuevo con tarjeta o Mercado Pago espera el pago.
create or replace function saborsazon.pago_inicial()
returns trigger
language plpgsql
set search_path = saborsazon
as $$
begin
  new.pago_estado := case
    when new.metodo_pago in ('tarjeta', 'billetera_virtual_checkout') then 'pendiente'
    else 'no_aplica'
  end;
  return new;
end;
$$;

drop trigger if exists pedidos_pago_inicial on saborsazon.pedidos;
create trigger pedidos_pago_inicial
  before insert on saborsazon.pedidos
  for each row execute function saborsazon.pago_inicial();

-- -----------------------------------------------------------------------------
-- Registrar el resultado de un pago (solo lo llaman las Edge Functions con
-- la clave de servicio, después de consultar el pago en Mercado Pago).
-- -----------------------------------------------------------------------------
create or replace function saborsazon.registrar_pago_mp(
  p_pedido uuid,
  p_estado text,
  p_pago_id text,
  p_monto numeric
)
returns text
language plpgsql
security definer
set search_path = saborsazon
as $$
declare
  v_pedido saborsazon.pedidos;
begin
  select * into v_pedido from saborsazon.pedidos where id = p_pedido for update;
  if not found then
    return 'pedido_inexistente';
  end if;
  if v_pedido.pago_estado = 'no_aplica' then
    return 'sin_pago_online';
  end if;
  if p_estado not in ('pendiente', 'aprobado', 'rechazado', 'reembolsado') then
    return 'estado_invalido';
  end if;
  -- Un pago aprobado solo puede pasar a reembolsado (no se "desaprueba"
  -- porque llegue tarde un aviso de un intento rechazado anterior).
  if v_pedido.pago_estado = 'aprobado' and p_estado <> 'reembolsado' then
    return v_pedido.pago_estado;
  end if;
  if v_pedido.pago_estado = 'reembolsado' then
    return v_pedido.pago_estado;
  end if;
  if p_estado = 'aprobado' and p_monto < v_pedido.total then
    raise warning 'Pago % del pedido % por % no cubre el total %', p_pago_id, v_pedido.numero, p_monto, v_pedido.total;
    return 'monto_insuficiente';
  end if;

  update saborsazon.pedidos
  set pago_estado = p_estado,
      mp_pago_id = coalesce(p_pago_id, mp_pago_id),
      pago_actualizado_en = now()
  where id = p_pedido;
  return p_estado;
end;
$$;

revoke execute on function saborsazon.registrar_pago_mp(uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function saborsazon.registrar_pago_mp(uuid, text, text, numeric) to service_role;

-- -----------------------------------------------------------------------------
-- Seguimiento: el cliente también ve el estado del pago.
-- -----------------------------------------------------------------------------
create or replace function saborsazon.ver_pedido(p_id uuid, p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = saborsazon
as $$
  select jsonb_build_object(
    'id', pe.id,
    'numero', pe.numero,
    'estado', pe.estado,
    'pagoEstado', pe.pago_estado,
    'metodoEntrega', pe.metodo_entrega,
    'metodoPago', pe.metodo_pago,
    'direccionEntrega', pe.direccion_entrega,
    'subtotal', pe.subtotal,
    'costoEnvio', pe.costo_envio,
    'recargo', pe.recargo,
    'total', pe.total,
    'creadoEn', pe.creado_en,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', i.nombre, 'cantidad', i.cantidad, 'precioUnitario', i.precio_unitario, 'opciones', i.opciones
      ) order by i.id)
      from saborsazon.items_pedido i where i.pedido_id = pe.id
    ), '[]'::jsonb)
  )
  from saborsazon.pedidos pe
  where pe.id = p_id and pe.codigo_seguimiento = p_codigo;
$$;

-- -----------------------------------------------------------------------------
-- Aviso push a recepción (reemplaza el de 0002): un pedido con pago online
-- avisa cuando se aprueba el pago, no cuando se crea.
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
  v_pagado text := case when new.pago_estado = 'aprobado' then ' · Pagado' else '' end;
begin
  if tg_op = 'INSERT' and new.pago_estado <> 'no_aplica' then
    return new; -- espera a que se apruebe el pago
  end if;
  if tg_op = 'UPDATE' and not (new.pago_estado = 'aprobado' and old.pago_estado is distinct from 'aprobado') then
    return new;
  end if;

  select jsonb_agg(jsonb_build_object(
    'to', d.token,
    'title', 'Nuevo pedido #' || new.numero,
    'body', new.nombre_cliente || ' · ' || v_total || v_pagado || ' · ' || v_entrega,
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
  raise warning 'No se pudo enviar el aviso del pedido %: %', new.numero, sqlerrm;
  return new;
end;
$$;

drop trigger if exists pedidos_avisar on saborsazon.pedidos;
create trigger pedidos_avisar
  after insert or update of pago_estado on saborsazon.pedidos
  for each row execute function saborsazon.avisar_nuevo_pedido();
