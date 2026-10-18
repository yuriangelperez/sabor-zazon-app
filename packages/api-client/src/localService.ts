import type { ConfiguracionLocal, CotizacionEnvio, TarifaEnvio } from '@sabor/types';

import { configuracionDesdeRow, type ConfiguracionRow } from './mapeos';
import { asegurarConfiguracion, ESQUEMA, supabase, supabaseConfigurado } from './supabaseClient';

export async function getConfiguracion(): Promise<ConfiguracionLocal> {
  asegurarConfiguracion();
  const { data, error } = await supabase
    .from('configuracion')
    .select(
      'pausado, pausado_hasta, mensaje_pausa, horario_apertura, horario_cierre, direccion_local, alias_transferencia, cvu, titular_cuenta, recargo_link_pago, delivery_activo, envio_base, envio_por_km, envio_km_maximo'
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

// Tarifa del envío por km. Vale para los pedidos que entren desde ahora
// (crear_pedido calcula el costo con la tarifa vigente).
export async function guardarTarifaEnvio(tarifa: TarifaEnvio): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase
    .from('configuracion')
    .update({
      delivery_activo: tarifa.deliveryActivo,
      envio_base: tarifa.envioBase,
      envio_por_km: tarifa.envioPorKm,
      envio_km_maximo: tarifa.envioKmMaximo,
    })
    .eq('id', 1);
  if (error) throw error;
}

// Busca la dirección en OpenStreetMap (Edge Function `cotizar-envio`) y
// devuelve la distancia por calle y el costo.
export async function cotizarEnvio(direccion: string): Promise<CotizacionEnvio> {
  asegurarConfiguracion();
  const { data, error } = await supabase.functions.invoke('cotizar-envio', { body: { direccion } });
  if (error) {
    // El mensaje en castellano viene en el cuerpo de la respuesta.
    const detalle = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detalle?.error ?? 'No pudimos calcular el envío. Probá de nuevo en unos minutos.');
  }
  return data as CotizacionEnvio;
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
