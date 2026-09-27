import type { ConfiguracionLocal, ZonaEnvio } from '@sabor/types';

import { configuracionDesdeRow, zonaDesdeRow, type ConfiguracionRow, type ZonaRow } from './mapeos';
import { asegurarConfiguracion, ESQUEMA, supabase, supabaseConfigurado } from './supabaseClient';
import { idDesdeNombre } from './texto';

export async function getConfiguracion(): Promise<ConfiguracionLocal> {
  asegurarConfiguracion();
  const { data, error } = await supabase
    .from('configuracion')
    .select(
      'pausado, pausado_hasta, mensaje_pausa, horario_apertura, horario_cierre, direccion_local, alias_transferencia, cvu, titular_cuenta, recargo_link_pago'
    )
    .eq('id', 1)
    .single();
  if (error) throw error;
  return configuracionDesdeRow(data as ConfiguracionRow);
}

// RF-13: "cerrar la tienda" / volver a recibir pedidos. Al cerrar, la base
// calcula hasta cuándo: la próxima apertura del horario (0004_horarios.sql).
export async function pausarRecepcion(pausado: boolean, mensaje?: string): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase
    .from('configuracion')
    .update({ pausado, mensaje_pausa: pausado ? (mensaje ?? null) : null })
    .eq('id', 1);
  if (error) throw error;
}

// Horario de atención ("HH:mm"). El local abre y cierra solo con este horario.
export async function guardarHorario(apertura: string, cierre: string): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase
    .from('configuracion')
    .update({ horario_apertura: apertura, horario_cierre: cierre })
    .eq('id', 1);
  if (error) throw error;
}

export async function getZonasEnvio(): Promise<ZonaEnvio[]> {
  asegurarConfiguracion();
  const { data, error } = await supabase
    .from('zonas_envio')
    .select('id, nombre, costo, activa')
    .eq('activa', true)
    .order('orden');
  if (error) throw error;
  return (data as ZonaRow[]).map(zonaDesdeRow);
}

// Recepción: todas las zonas, también las desactivadas.
export async function getZonasEnvioAdmin(): Promise<ZonaEnvio[]> {
  asegurarConfiguracion();
  const { data, error } = await supabase.from('zonas_envio').select('id, nombre, costo, activa').order('orden').order('nombre');
  if (error) throw error;
  return (data as ZonaRow[]).map(zonaDesdeRow);
}

// Cambia nombre, costo o si está activa. El costo nuevo vale para los
// pedidos que entren desde ahora (crear_pedido lo lee de esta tabla).
export async function actualizarZonaEnvio(id: string, cambios: Partial<Omit<ZonaEnvio, 'id'>>): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase.from('zonas_envio').update(cambios).eq('id', id);
  if (error) throw error;
}

export async function crearZonaEnvio(nombre: string, costo: number): Promise<void> {
  asegurarConfiguracion();
  const { count } = await supabase.from('zonas_envio').select('id', { count: 'exact', head: true });
  const { error } = await supabase
    .from('zonas_envio')
    .insert({ id: idDesdeNombre(nombre), nombre: nombre.trim(), costo, activa: true, orden: count ?? 0 });
  if (error?.code === '23505') throw new Error(`Ya existe una zona llamada "${nombre.trim()}".`);
  if (error) throw error;
}

export function suscribirConfiguracion(onCambio: () => void): () => void {
  if (!supabaseConfigurado) return () => {};
  const canal = supabase
    .channel(`configuracion-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: ESQUEMA, table: 'configuracion' }, onCambio)
    .subscribe();
  return () => {
    void supabase.removeChannel(canal);
  };
}
