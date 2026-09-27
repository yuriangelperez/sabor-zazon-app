import type { ConfiguracionLocal, ZonaEnvio } from '@sabor/types';

import { configuracionDesdeRow, zonaDesdeRow, type ConfiguracionRow, type ZonaRow } from './mapeos';
import { asegurarConfiguracion, ESQUEMA, supabase, supabaseConfigurado } from './supabaseClient';

export async function getConfiguracion(): Promise<ConfiguracionLocal> {
  asegurarConfiguracion();
  const { data, error } = await supabase
    .from('configuracion')
    .select(
      'pausado, mensaje_pausa, horario_apertura, horario_cierre, direccion_local, alias_transferencia, cvu, titular_cuenta, recargo_link_pago'
    )
    .eq('id', 1)
    .single();
  if (error) throw error;
  return configuracionDesdeRow(data as ConfiguracionRow);
}

// RF-13: "cerrar la tienda" / volver a recibir pedidos.
export async function pausarRecepcion(pausado: boolean, mensaje?: string): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase
    .from('configuracion')
    .update({ pausado, mensaje_pausa: pausado ? (mensaje ?? null) : null })
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
