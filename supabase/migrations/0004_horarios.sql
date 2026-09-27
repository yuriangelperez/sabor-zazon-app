-- =============================================================================
-- Sabor y Sazón — horario editable y cierre manual hasta la próxima apertura
--
-- - El local abre y cierra solo según horario_apertura / horario_cierre
--   (se editan desde recepción → Ajustes).
-- - Si recepción lo cierra a mano, queda cerrado hasta la próxima apertura
--   del horario (ej. cerrado hoy a las 15:00 → vuelve a abrir mañana a las
--   10:00). También se puede reabrir a mano antes.
--
-- Ejecutar en Supabase: SQL Editor → pegar este archivo → Run.
-- Requiere 0001_esquema.sql.
-- =============================================================================

alter table saborsazon.configuracion
  add column if not exists pausado_hasta timestamptz;

-- Abrir y cerrar a la misma hora dejaría el local siempre cerrado.
alter table saborsazon.configuracion drop constraint if exists configuracion_horario_valido;
alter table saborsazon.configuracion
  add constraint configuracion_horario_valido check (horario_apertura <> horario_cierre);

-- Próxima apertura "del día siguiente" según el horario:
-- - horario normal (10:00 a 22:00): mañana a la hora de apertura;
-- - horario que cruza la medianoche (18:00 a 02:00) y todavía estamos en el
--   turno que empezó ayer (ej. 01:00): hoy a la hora de apertura.
create or replace function saborsazon.proxima_apertura(
  p_apertura time,
  p_cierre time,
  p_zona text,
  p_ahora timestamptz default now()
)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_local timestamp := p_ahora at time zone p_zona;
  v_dia date := v_local::date + 1;
begin
  if p_apertura > p_cierre and v_local::time < p_cierre then
    v_dia := v_local::date;
  end if;
  return (v_dia + p_apertura) at time zone p_zona;
end;
$$;

-- Al cerrar a mano se calcula hasta cuándo; al reabrir se limpia.
create or replace function saborsazon.calcular_pausa()
returns trigger
language plpgsql
set search_path = saborsazon
as $$
begin
  if not new.pausado then
    new.pausado_hasta := null;
    new.mensaje_pausa := null;
  elsif not old.pausado
     or old.pausado_hasta is null
     or old.pausado_hasta <= now()
     or new.horario_apertura is distinct from old.horario_apertura
     or new.horario_cierre is distinct from old.horario_cierre then
    new.pausado_hasta := saborsazon.proxima_apertura(new.horario_apertura, new.horario_cierre, new.zona_horaria);
  end if;
  return new;
end;
$$;

drop trigger if exists configuracion_pausa on saborsazon.configuracion;
create trigger configuracion_pausa
  before update on saborsazon.configuracion
  for each row execute function saborsazon.calcular_pausa();

-- Si ya estaba cerrado a mano, vence en la próxima apertura.
update saborsazon.configuracion
set pausado_hasta = saborsazon.proxima_apertura(horario_apertura, horario_cierre, zona_horaria)
where pausado and pausado_hasta is null;

-- ¿El local está recibiendo pedidos ahora? (cierre manual vigente + horario)
create or replace function saborsazon.local_abierto()
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
  if not found then
    return false;
  end if;
  if cfg.pausado and (cfg.pausado_hasta is null or now() < cfg.pausado_hasta) then
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

grant execute on function saborsazon.local_abierto() to anon, authenticated;
grant execute on function saborsazon.proxima_apertura(time, time, text, timestamptz) to anon, authenticated;
