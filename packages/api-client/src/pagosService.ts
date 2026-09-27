import type { PagoEstado } from '@sabor/types';

import { asegurarConfiguracion, supabase } from './supabaseClient';

// Pagos con Mercado Pago (Checkout Pro) a través de la Edge Function
// `mp-pago` (supabase/functions): el Access Token nunca llega a la app.

async function llamar<T>(cuerpo: Record<string, string>): Promise<T> {
  asegurarConfiguracion();
  const { data, error } = await supabase.functions.invoke('mp-pago', { body: cuerpo });
  if (error) {
    // El mensaje en castellano viene en el cuerpo de la respuesta.
    const detalle = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detalle?.error ?? 'No pudimos conectar con Mercado Pago. Probá de nuevo en unos minutos.');
  }
  return data as T;
}

// Devuelve la URL de Mercado Pago donde el cliente paga su pedido.
export async function iniciarPagoMercadoPago(id: string, codigo: string): Promise<string> {
  const { url } = await llamar<{ url: string }>({ accion: 'crear', id, codigo });
  return url;
}

// El cliente cancela un pedido que todavía no pagó. Falla si el pago ya se
// aprobó (en ese caso el pedido sigue en curso).
export async function cancelarPedidoSinPagar(id: string, codigo: string): Promise<void> {
  await llamar<{ estado: string }>({ accion: 'cancelar', id, codigo });
}

// Pregunta a Mercado Pago si el pedido ya se pagó (al volver de pagar).
export async function verificarPagoMercadoPago(id: string, codigo: string): Promise<PagoEstado> {
  const { pagoEstado } = await llamar<{ pagoEstado: PagoEstado }>({ accion: 'verificar', id, codigo });
  return pagoEstado;
}
