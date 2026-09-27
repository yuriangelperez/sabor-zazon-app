-- =============================================================================
-- Sabor y Sazón — esquema inicial
-- Todas las tablas viven en el esquema `saborsazon` (así no chocan con otros
-- proyectos que usen `public` en la misma base de Supabase).
--
-- 1. Ejecutar en Supabase: SQL Editor → pegar este archivo → Run.
-- 2. Ejecutar supabase/seed.sql para cargar el menú.
-- 3. Project Settings → Data API → "Exposed schemas": agregar `saborsazon`.
-- =============================================================================

create schema if not exists saborsazon;

grant usage on schema saborsazon to anon, authenticated, service_role;
alter default privileges in schema saborsazon grant all on tables to anon, authenticated, service_role;
alter default privileges in schema saborsazon grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema saborsazon grant execute on functions to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type saborsazon.rol_usuario as enum ('cliente', 'recepcionista', 'duena');
create type saborsazon.estado_pedido as enum ('por_aceptar', 'en_preparacion', 'listo', 'entregado', 'cancelado', 'rechazado');
create type saborsazon.metodo_entrega as enum ('delivery', 'retiro_local');
create type saborsazon.metodo_pago as enum ('tarjeta', 'billetera_virtual_checkout', 'billetera_virtual_alias', 'efectivo');

-- -----------------------------------------------------------------------------
-- Perfiles y roles (RF-14). Cada usuario de Supabase Auth tiene un perfil;
-- por defecto es 'cliente'. A recepción y a la dueña se les cambia el rol
-- desde el SQL Editor (ver README).
-- -----------------------------------------------------------------------------
create table saborsazon.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nombre text,
  celular text,
  rol saborsazon.rol_usuario not null default 'cliente',
  creado_en timestamptz not null default now()
);

create function saborsazon.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = saborsazon
as $$
begin
  insert into saborsazon.perfiles (id, email, nombre)
  values (new.id, new.email, new.raw_user_meta_data ->> 'nombre')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger saborsazon_al_crear_usuario
  after insert on auth.users
  for each row execute function saborsazon.crear_perfil_nuevo_usuario();

-- ¿El usuario actual es de recepción o la dueña?
create function saborsazon.es_staff()
returns boolean
language sql
stable
security definer
set search_path = saborsazon
as $$
  select exists (
    select 1 from saborsazon.perfiles
    where id = auth.uid() and rol in ('recepcionista', 'duena')
  );
$$;

-- -----------------------------------------------------------------------------
-- Configuración del local (una sola fila) y zonas de envío
-- -----------------------------------------------------------------------------
create table saborsazon.configuracion (
  id smallint primary key default 1 check (id = 1),
  pausado boolean not null default false,          -- RF-13: "cerrar tienda" a mano
  mensaje_pausa text,
  horario_apertura time not null default '10:00',
  horario_cierre time not null default '22:00',
  zona_horaria text not null default 'America/Argentina/Buenos_Aires',
  direccion_local text not null default 'San Ignacio 663, Manuel Alberti, Pilar',
  alias_transferencia text,
  cvu text,
  titular_cuenta text,
  recargo_link_pago numeric(5, 2) not null default 5 check (recargo_link_pago >= 0),
  actualizado_en timestamptz not null default now()
);

create table saborsazon.zonas_envio (
  id text primary key,
  nombre text not null,
  costo integer not null check (costo >= 0),
  activa boolean not null default true,
  orden integer not null default 0
);

-- ¿El local está recibiendo pedidos ahora? (pausa manual + horario)
create function saborsazon.local_abierto()
returns boolean
language plpgsql
stable
security definer
set search_path = saborsazon
as $$
declare
  cfg saborsazon.configuracion;
  ahora time;
begin
  select * into cfg from saborsazon.configuracion where id = 1;
  if not found or cfg.pausado then
    return false;
  end if;
  ahora := (now() at time zone cfg.zona_horaria)::time;
  if cfg.horario_apertura <= cfg.horario_cierre then
    return ahora >= cfg.horario_apertura and ahora < cfg.horario_cierre;
  end if;
  -- horario que cruza la medianoche (ej. 18:00 a 02:00)
  return ahora >= cfg.horario_apertura or ahora < cfg.horario_cierre;
end;
$$;

-- -----------------------------------------------------------------------------
-- Menú (RF-01, RF-12)
-- -----------------------------------------------------------------------------
create table saborsazon.ingredientes (
  id text primary key,
  nombre text not null,
  agotado boolean not null default false
);

create table saborsazon.productos (
  id text primary key default gen_random_uuid()::text,
  nombre text not null check (length(trim(nombre)) > 0),
  descripcion text not null default '',
  imagen text not null default '',                 -- clave de foto incluida o URL de Storage
  precio integer not null check (precio >= 0),
  descuento_porcentaje integer not null default 0 check (descuento_porcentaje between 0 and 100),
  categoria_base text not null check (
    categoria_base in ('arepa', 'tequeño', 'empanada', 'bebida', 'postre', 'acompañamiento', 'combo')
  ),
  categorias_momento text[] not null default '{}',
  rellenos text[] not null default '{}',
  es_combo boolean not null default false,
  grupos_opciones jsonb not null default '[]' check (jsonb_typeof(grupos_opciones) = 'array'),
  acompanamientos text[] not null default '{}',
  ingredientes text[] not null default '{}',
  activo boolean not null default true,            -- false = desactivado indefinidamente
  desactivado_hasta timestamptz,                   -- "sin stock por hoy"
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index productos_categoria_idx on saborsazon.productos (categoria_base, orden);

-- -----------------------------------------------------------------------------
-- Pedidos (RF-06, RF-09 a RF-11)
-- -----------------------------------------------------------------------------
create table saborsazon.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  estado saborsazon.estado_pedido not null default 'por_aceptar',
  cliente_id uuid references auth.users (id) on delete set null,
  nombre_cliente text not null,
  celular_cliente text not null,
  metodo_entrega saborsazon.metodo_entrega not null,
  zona_envio_id text references saborsazon.zonas_envio (id),
  direccion_entrega text,
  costo_envio integer not null default 0,
  metodo_pago saborsazon.metodo_pago not null,
  subtotal integer not null default 0,
  recargo integer not null default 0,
  descuento integer not null default 0,
  propina integer not null default 0,
  total integer not null default 0,
  observaciones text,
  terminos_aceptados boolean not null check (terminos_aceptados),
  codigo_seguimiento text not null default replace(gen_random_uuid()::text, '-', ''),
  creado_en timestamptz not null default now(),
  aceptado_en timestamptz,
  listo_en timestamptz,
  entregado_en timestamptz,
  cancelado_en timestamptz
);

create index pedidos_estado_idx on saborsazon.pedidos (estado, creado_en desc);
create index pedidos_creado_idx on saborsazon.pedidos (creado_en desc);

create table saborsazon.items_pedido (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references saborsazon.pedidos (id) on delete cascade,
  producto_id text references saborsazon.productos (id) on delete set null,
  nombre text not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario integer not null check (precio_unitario >= 0),
  opciones jsonb not null default '[]',
  acompanamientos text[] not null default '{}'
);

create index items_pedido_pedido_idx on saborsazon.items_pedido (pedido_id);

-- Registra la hora de cada cambio de estado (para el tablero y métricas).
create function saborsazon.registrar_tiempos_pedido()
returns trigger
language plpgsql
as $$
begin
  if new.estado is distinct from old.estado then
    case new.estado
      when 'en_preparacion' then new.aceptado_en := coalesce(new.aceptado_en, now());
      when 'listo' then new.listo_en := coalesce(new.listo_en, now());
      when 'entregado' then new.entregado_en := coalesce(new.entregado_en, now());
      when 'cancelado', 'rechazado' then new.cancelado_en := coalesce(new.cancelado_en, now());
      else null;
    end case;
  end if;
  return new;
end;
$$;

create trigger pedidos_tiempos
  before update on saborsazon.pedidos
  for each row execute function saborsazon.registrar_tiempos_pedido();

create function saborsazon.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger productos_actualizado before update on saborsazon.productos
  for each row execute function saborsazon.tocar_actualizado_en();
create trigger configuracion_actualizado before update on saborsazon.configuracion
  for each row execute function saborsazon.tocar_actualizado_en();

-- -----------------------------------------------------------------------------
-- crear_pedido: único camino para crear pedidos. Recalcula todos los precios
-- desde la tabla productos (el cliente no puede mandar precios), valida que
-- el local esté abierto, que los productos y opciones estén disponibles y
-- que cada combo esté completo.
-- -----------------------------------------------------------------------------
create function saborsazon.crear_pedido(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = saborsazon
as $$
declare
  cfg saborsazon.configuracion;
  v_pedido saborsazon.pedidos;
  v_item jsonb;
  v_prod saborsazon.productos;
  v_grupo jsonb;
  v_elegida jsonb;
  v_opcion jsonb;
  v_opciones jsonb;
  v_cantidad integer;
  v_cant_opcion integer;
  v_cant_grupo integer;
  v_extra integer;
  v_precio integer;
  v_subtotal integer := 0;
  v_envio integer := 0;
  v_recargo integer := 0;
  v_entrega saborsazon.metodo_entrega;
  v_pago saborsazon.metodo_pago;
  v_agotados text[];
  v_items jsonb := '[]'::jsonb;
begin
  select * into cfg from saborsazon.configuracion where id = 1;
  if not saborsazon.local_abierto() then
    raise exception 'El local no está recibiendo pedidos en este momento.' using errcode = 'P0001';
  end if;

  if coalesce(trim(p ->> 'nombreCliente'), '') = '' or coalesce(trim(p ->> 'celularCliente'), '') = '' then
    raise exception 'Completá tu nombre y tu celular.' using errcode = 'P0001';
  end if;
  if coalesce((p ->> 'terminosAceptados')::boolean, false) is not true then
    raise exception 'Tenés que aceptar los términos y condiciones.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p -> 'items') <> 'array' or jsonb_array_length(p -> 'items') = 0 then
    raise exception 'El carrito está vacío.' using errcode = 'P0001';
  end if;

  v_entrega := (p ->> 'metodoEntrega')::saborsazon.metodo_entrega;
  v_pago := (p ->> 'metodoPago')::saborsazon.metodo_pago;

  if v_entrega = 'delivery' then
    if coalesce(trim(p ->> 'direccionEntrega'), '') = '' then
      raise exception 'Ingresá la dirección de entrega.' using errcode = 'P0001';
    end if;
    select costo into v_envio from saborsazon.zonas_envio where id = p ->> 'zonaEnvioId' and activa;
    if not found then
      raise exception 'Elegí una zona de envío válida.' using errcode = 'P0001';
    end if;
  end if;

  select array_agg(id) into v_agotados from saborsazon.ingredientes where agotado;
  v_agotados := coalesce(v_agotados, '{}');

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    select * into v_prod from saborsazon.productos where id = v_item ->> 'productoId';
    if not found
       or not v_prod.activo
       or (v_prod.desactivado_hasta is not null and v_prod.desactivado_hasta > now())
       or v_prod.ingredientes && v_agotados then
      raise exception '"%" ya no está disponible. Quitalo del carrito para continuar.',
        coalesce(v_prod.nombre, 'Un producto') using errcode = 'P0001';
    end if;

    v_cantidad := (v_item ->> 'cantidad')::integer;
    if v_cantidad is null or v_cantidad < 1 or v_cantidad > 50 then
      raise exception 'Cantidad inválida para "%".', v_prod.nombre using errcode = 'P0001';
    end if;

    -- Opciones elegidas: se buscan en el producto y se arma la foto del ítem
    -- con los nombres y precios de la base de datos.
    v_extra := 0;
    v_opciones := '[]'::jsonb;
    for v_elegida in select * from jsonb_array_elements(coalesce(v_item -> 'opciones', '[]'::jsonb)) loop
      select g, o into v_grupo, v_opcion
      from jsonb_array_elements(v_prod.grupos_opciones) g,
           jsonb_array_elements(g -> 'opciones') o
      where g ->> 'id' = v_elegida ->> 'grupoId'
        and o ->> 'id' = v_elegida ->> 'opcionId';
      if v_opcion is null then
        raise exception 'Una opción de "%" ya no existe. Volvé a armarlo.', v_prod.nombre using errcode = 'P0001';
      end if;
      if exists (
        select 1 from jsonb_array_elements_text(coalesce(v_opcion -> 'ingredientes', '[]'::jsonb)) i
        where i = any (v_agotados)
      ) then
        raise exception '"%" en "%" está agotado.', v_opcion ->> 'nombre', v_prod.nombre using errcode = 'P0001';
      end if;

      v_cant_opcion := case when v_grupo ->> 'tipo' = 'unica' then 1
                            else greatest(1, coalesce((v_elegida ->> 'cantidad')::integer, 1)) end;
      v_extra := v_extra + coalesce((v_opcion ->> 'precioAdicional')::integer, 0) * v_cant_opcion;
      v_opciones := v_opciones || jsonb_build_object(
        'grupoId', v_grupo ->> 'id',
        'grupoNombre', coalesce(v_grupo ->> 'seccion', v_grupo ->> 'nombre'),
        'opcionId', v_opcion ->> 'id',
        'nombre', v_opcion ->> 'nombre',
        'cantidad', v_cant_opcion,
        'precioAdicional', coalesce((v_opcion ->> 'precioAdicional')::integer, 0)
      );
      v_opcion := null;
    end loop;

    -- Cada grupo tiene que respetar su mínimo y máximo (combos completos).
    for v_grupo in select * from jsonb_array_elements(v_prod.grupos_opciones) loop
      select coalesce(sum((o ->> 'cantidad')::integer), 0) into v_cant_grupo
      from jsonb_array_elements(v_opciones) o
      where o ->> 'grupoId' = v_grupo ->> 'id';
      if v_cant_grupo < (v_grupo ->> 'minimo')::integer or v_cant_grupo > (v_grupo ->> 'maximo')::integer then
        raise exception 'Falta completar "%" en "%".',
          coalesce(v_grupo ->> 'seccion', v_grupo ->> 'nombre'), v_prod.nombre using errcode = 'P0001';
      end if;
    end loop;

    v_precio := round(v_prod.precio * (100 - v_prod.descuento_porcentaje) / 100.0)::integer + v_extra;
    v_subtotal := v_subtotal + v_precio * v_cantidad;

    v_items := v_items || jsonb_build_object(
      'producto_id', v_prod.id,
      'nombre', v_prod.nombre,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'opciones', v_opciones,
      'acompanamientos', to_jsonb(v_prod.acompanamientos)
    );
  end loop;

  -- Recargo por pagar con tarjeta o link de pago (Mercado Pago).
  if v_pago in ('tarjeta', 'billetera_virtual_checkout') then
    v_recargo := round(v_subtotal * cfg.recargo_link_pago / 100.0)::integer;
  end if;

  -- Recién acá, con todo validado, se crea el pedido. Así un intento fallido
  -- no consume un número de orden y recepción no ve saltos (#1, #4...).
  insert into saborsazon.pedidos (
    cliente_id, nombre_cliente, celular_cliente, metodo_entrega, zona_envio_id,
    direccion_entrega, metodo_pago, observaciones, terminos_aceptados,
    costo_envio, subtotal, recargo, total
  ) values (
    auth.uid(),
    trim(p ->> 'nombreCliente'),
    trim(p ->> 'celularCliente'),
    v_entrega,
    case when v_entrega = 'delivery' then p ->> 'zonaEnvioId' end,
    case when v_entrega = 'delivery' then trim(p ->> 'direccionEntrega') end,
    v_pago,
    nullif(trim(coalesce(p ->> 'observaciones', '')), ''),
    true,
    v_envio,
    v_subtotal,
    v_recargo,
    v_subtotal + v_envio + v_recargo
  ) returning * into v_pedido;

  insert into saborsazon.items_pedido (pedido_id, producto_id, nombre, cantidad, precio_unitario, opciones, acompanamientos)
  select v_pedido.id,
         i ->> 'producto_id',
         i ->> 'nombre',
         (i ->> 'cantidad')::integer,
         (i ->> 'precio_unitario')::integer,
         i -> 'opciones',
         array(select jsonb_array_elements_text(i -> 'acompanamientos'))
  from jsonb_array_elements(v_items) i;

  return jsonb_build_object(
    'id', v_pedido.id,
    'numero', v_pedido.numero,
    'codigoSeguimiento', v_pedido.codigo_seguimiento,
    'total', v_pedido.total
  );
end;
$$;

-- Seguimiento del pedido para el cliente (sin cuenta): necesita el id y el
-- código secreto que recibió al comprar.
create function saborsazon.ver_pedido(p_id uuid, p_codigo text)
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
-- Seguridad (RLS)
-- -----------------------------------------------------------------------------
alter table saborsazon.perfiles enable row level security;
alter table saborsazon.configuracion enable row level security;
alter table saborsazon.zonas_envio enable row level security;
alter table saborsazon.ingredientes enable row level security;
alter table saborsazon.productos enable row level security;
alter table saborsazon.pedidos enable row level security;
alter table saborsazon.items_pedido enable row level security;

-- Perfiles: cada uno ve el suyo; staff ve todos. El rol no se edita desde la app.
create policy "perfil propio o staff" on saborsazon.perfiles
  for select using (id = auth.uid() or saborsazon.es_staff());

-- Menú, configuración y zonas: lectura pública, escritura solo staff.
create policy "lectura publica" on saborsazon.configuracion for select using (true);
create policy "staff edita" on saborsazon.configuracion for update using (saborsazon.es_staff()) with check (saborsazon.es_staff());

create policy "lectura publica" on saborsazon.zonas_envio for select using (true);
create policy "staff gestiona" on saborsazon.zonas_envio for all using (saborsazon.es_staff()) with check (saborsazon.es_staff());

create policy "lectura publica" on saborsazon.ingredientes for select using (true);
create policy "staff gestiona" on saborsazon.ingredientes for all using (saborsazon.es_staff()) with check (saborsazon.es_staff());

create policy "lectura publica" on saborsazon.productos for select using (true);
create policy "staff gestiona" on saborsazon.productos for all using (saborsazon.es_staff()) with check (saborsazon.es_staff());

-- Pedidos: se crean solo con crear_pedido(); staff los ve y cambia su estado.
create policy "staff ve pedidos" on saborsazon.pedidos for select using (saborsazon.es_staff());
create policy "staff actualiza pedidos" on saborsazon.pedidos for update using (saborsazon.es_staff()) with check (saborsazon.es_staff());
create policy "staff ve items" on saborsazon.items_pedido for select using (saborsazon.es_staff());

grant execute on function saborsazon.crear_pedido(jsonb) to anon, authenticated;
grant execute on function saborsazon.ver_pedido(uuid, text) to anon, authenticated;
grant execute on function saborsazon.local_abierto() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Tiempo real (RNF-02): el tablero de recepción escucha los pedidos y el
-- menú del cliente se actualiza al instante cuando staff cambia algo.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table saborsazon.pedidos;
alter publication supabase_realtime add table saborsazon.productos;
alter publication supabase_realtime add table saborsazon.ingredientes;
alter publication supabase_realtime add table saborsazon.configuracion;

-- -----------------------------------------------------------------------------
-- Storage: fotos de productos nuevos (lectura pública, subida solo staff).
-- Bucket propio del proyecto para no mezclarse con otros.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('saborsazon-productos', 'saborsazon-productos', true)
on conflict (id) do nothing;

create policy "saborsazon: staff sube fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'saborsazon-productos' and saborsazon.es_staff());
create policy "saborsazon: staff actualiza fotos" on storage.objects
  for update to authenticated using (bucket_id = 'saborsazon-productos' and saborsazon.es_staff());
create policy "saborsazon: staff borra fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'saborsazon-productos' and saborsazon.es_staff());

-- Permisos explícitos por si el esquema ya existía antes de correr este archivo
-- (las filas igual quedan protegidas por las políticas RLS de arriba).
grant all on all tables in schema saborsazon to anon, authenticated, service_role;
grant all on all sequences in schema saborsazon to anon, authenticated, service_role;
grant execute on all functions in schema saborsazon to anon, authenticated, service_role;
