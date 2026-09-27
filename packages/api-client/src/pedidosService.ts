import type { EstadoPedido, NuevoPedido, Pedido, PedidoCreado } from '@sabor/types';
import { ESTADOS_ACTIVOS } from '@sabor/types';

import { pedidoDesdeRow, type PedidoRow } from './mapeos';
import { asegurarConfiguracion, ESQUEMA, supabase, supabaseConfigurado } from './supabaseClient';

const COLUMNAS_PEDIDO = `
  id, numero, estado, nombre_cliente, celular_cliente, metodo_entrega, zona_envio_id,
  direccion_entrega, costo_envio, metodo_pago, subtotal, recargo, descuento, propina, total,
  observaciones, creado_en, aceptado_en, listo_en, entregado_en, cancelado_en,
  items_pedido ( id, producto_id, nombre, cantidad, precio_unitario, opciones, acompanamientos )
`;

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------

// RF-06: crea el pedido. La base de datos recalcula precios y valida todo.
export async function crearPedido(pedido: NuevoPedido): Promise<PedidoCreado> {
  asegurarConfiguracion();
  const { data, error } = await supabase.rpc('crear_pedido', { p: pedido });
  if (error) throw error;
  return data as PedidoCreado;
}

export interface SeguimientoPedido {
  id: string;
  numero: number;
  estado: EstadoPedido;
  metodoEntrega: Pedido['metodoEntrega'];
  metodoPago: Pedido['metodoPago'];
  direccionEntrega: string | null;
  subtotal: number;
  costoEnvio: number;
  recargo: number;
  total: number;
  creadoEn: string;
  items: { nombre: string; cantidad: number; precioUnitario: number; opciones: Pedido['items'][number]['opciones'] }[];
}

// RF-07: estado del pedido para el cliente (con el código que recibió).
export async function verPedido(id: string, codigo: string): Promise<SeguimientoPedido | null> {
  asegurarConfiguracion();
  const { data, error } = await supabase.rpc('ver_pedido', { p_id: id, p_codigo: codigo });
  if (error) throw error;
  return (data as SeguimientoPedido | null) ?? null;
}

// ---------------------------------------------------------------------------
// Recepción (requiere sesión de staff)
// ---------------------------------------------------------------------------

// RF-09: pedidos en curso (por aceptar, en preparación, listos).
export async function getPedidosActivos(): Promise<Pedido[]> {
  asegurarConfiguracion();
  const { data, error } = await supabase
    .from('pedidos')
    .select(COLUMNAS_PEDIDO)
    .in('estado', ESTADOS_ACTIVOS)
    .order('creado_en', { ascending: true });
  if (error) throw error;
  return (data as PedidoRow[]).map(pedidoDesdeRow);
}

// Resumen de pedidos: todos los estados desde una fecha (ej. hoy a las 00:00).
export async function getPedidosDesde(desde: Date): Promise<Pedido[]> {
  asegurarConfiguracion();
  const { data, error } = await supabase
    .from('pedidos')
    .select(COLUMNAS_PEDIDO)
    .gte('creado_en', desde.toISOString())
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return (data as PedidoRow[]).map(pedidoDesdeRow);
}

// RF-11: aceptar, marcar listo, entregado/retirado, rechazar.
export async function cambiarEstadoPedido(id: string, estado: EstadoPedido): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase.from('pedidos').update({ estado }).eq('id', id);
  if (error) throw error;
}

export interface EventoPedido {
  tipo: 'nuevo' | 'actualizado';
  numero: number;
}

// RNF-02: escucha los pedidos en tiempo real (WebSocket de Supabase).
export function suscribirPedidos(onEvento: (evento: EventoPedido) => void): () => void {
  if (!supabaseConfigurado) return () => {};
  const canal = supabase
    .channel(`pedidos-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: ESQUEMA, table: 'pedidos' }, (payload) =>
      onEvento({ tipo: 'nuevo', numero: (payload.new as { numero: number }).numero })
    )
    .on('postgres_changes', { event: 'UPDATE', schema: ESQUEMA, table: 'pedidos' }, (payload) =>
      onEvento({ tipo: 'actualizado', numero: (payload.new as { numero: number }).numero })
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(canal);
  };
}
