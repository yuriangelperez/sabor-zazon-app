-- =============================================================================
-- Sabor y Sazón — recepción ve dónde quedó el pin del mapa
--
-- Si el cliente escribe una dirección y después mueve el pin a otra calle
-- (ej. escribe "San Ignacio" y marca en Formosa), recepción solo veía el
-- texto. Ahora cada pedido guarda también la dirección donde quedó el punto
-- (direccion_mapa: la que encontró el buscador o, si marcó en el mapa, la
-- que hay en ese punto) y si lo marcó a mano (ubicacion_marcada).
--
-- Ejecutar en Supabase: SQL Editor → pegar este archivo → Run.
-- Requiere 0005_envio_por_km.sql.
-- =============================================================================

alter table saborsazon.cotizaciones_envio
  add column if not exists marcada boolean not null default false; -- pin puesto a mano en el mapa

alter table saborsazon.pedidos
  add column if not exists direccion_mapa text,
  add column if not exists ubicacion_marcada boolean not null default false;

-- -----------------------------------------------------------------------------
-- crear_pedido: igual que en 0005, guardando también direccion_mapa y
-- ubicacion_marcada.
-- -----------------------------------------------------------------------------
create or replace function saborsazon.crear_pedido(p jsonb)
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
  v_cotizacion saborsazon.cotizaciones_envio;
  v_direccion text;
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
    if not cfg.delivery_activo then
      raise exception 'Por ahora no hacemos delivery: podés retirar en el local.' using errcode = 'P0001';
    end if;
    -- La distancia sale de la cotización que hizo `cotizar-envio`
    -- (OpenStreetMap) y el costo se recalcula acá con la tarifa vigente.
    select * into v_cotizacion from saborsazon.cotizaciones_envio
    where id = (p ->> 'cotizacionEnvioId')::uuid
      and creado_en > now() - interval '1 day';
    if not found then
      raise exception 'Volvé a calcular el envío de tu dirección.' using errcode = 'P0001';
    end if;
    v_envio := saborsazon.costo_envio(v_cotizacion.distancia_m);
    if v_envio is null then
      raise exception 'Tu dirección está a % km y llegamos hasta % km. Podés retirar en el local.',
        saborsazon.km_texto(v_cotizacion.distancia_m / 1000.0), saborsazon.km_texto(cfg.envio_km_maximo)
        using errcode = 'P0001';
    end if;
    -- Lo que escribió el cliente + piso, depto o timbre (no se geocodifica).
    v_direccion := v_cotizacion.direccion_buscada
      || coalesce(' — ' || nullif(trim(coalesce(p ->> 'detalleDireccion', '')), ''), '');
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
    cliente_id, nombre_cliente, celular_cliente, metodo_entrega,
    direccion_entrega, direccion_mapa, ubicacion_marcada, distancia_envio_m, entrega_lat, entrega_lng,
    metodo_pago, observaciones, terminos_aceptados,
    costo_envio, subtotal, recargo, total
  ) values (
    auth.uid(),
    trim(p ->> 'nombreCliente'),
    trim(p ->> 'celularCliente'),
    v_entrega,
    v_direccion,
    v_cotizacion.direccion_encontrada,
    coalesce(v_cotizacion.marcada, false),
    v_cotizacion.distancia_m,
    v_cotizacion.lat,
    v_cotizacion.lng,
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
