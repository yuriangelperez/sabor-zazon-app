import type { EstadoPedido, NuevoPedido, Pedido, PedidoCreado } from '@sabor/types';
import { ESTADOS_ACTIVOS, PAGOS_VISIBLES } from '@sabor/types';

import { pedidoDesdeRow, type PedidoRow } from './mapeos';
import { asegurarConfiguracion, ESQUEMA, supabase, supabaseConfigurado } from './supabaseClient';

const COLUMNAS_PEDIDO = `
  id, numero, estado, nombre_cliente, celular_cliente, metodo_entrega, zona_envio_id,
  direccion_entrega, direccion_mapa, ubicacion_marcada, distancia_envio_m, entrega_lat, entrega_lng, costo_envio, metodo_pago, pago_estado, subtotal, recargo, descuento, propina, total,
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
  pagoEstado: Pedido['pagoEstado'];
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
  if (!data) return null;
  const seguimiento = data as SeguimientoPedido;
  return { ...seguimiento, pagoEstado: seguimiento.pagoEstado ?? 'no_aplica' };
}

// ---------------------------------------------------------------------------
// Recepción (requiere sesión de staff)
// ---------------------------------------------------------------------------

// RF-09: pedidos en curso (por aceptar, en preparación, listos). Los que
// esperan el pago de Mercado Pago no se muestran hasta que se aprueba.
export async function getPedidosActivos(): Promise<Pedido[]> {
  asegurarConfiguracion();
  const { data, error } = await supabase
    .from('pedidos')
    .select(COLUMNAS_PEDIDO)
    .in('estado', ESTADOS_ACTIVOS)
    .in('pago_estado', PAGOS_VISIBLES)
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
    .in('pago_estado', PAGOS_VISIBLES)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return (data as PedidoRow[]).map(pedidoDesdeRow);
}

// Tope explícito de filas para las consultas por rango del resumen. Alto para
// no cortar el uso normal (un mes cargado entra holgado), pero acota la
// consulta y permite detectar truncado: si la respuesta llega a este número,
// el resumen avisa que el período puede estar incompleto y las métricas
// podrían subcontar. Así no dependemos de un tope invisible del servidor.
export const LIMITE_PEDIDOS_RANGO = 5000;

// Resumen de pedidos: todos los estados entre dos fechas (el límite superior
// es exclusivo). Para los filtros por día/semana/mes/rango del resumen de
// ventas, que acota la consulta en el servidor en vez de traer todo el
// historial y filtrarlo en la app.
export async function getPedidosEntre(desde: Date, hasta: Date): Promise<Pedido[]> {
  asegurarConfiguracion();
  const { data, error } = await supabase
    .from('pedidos')
    .select(COLUMNAS_PEDIDO)
    .gte('creado_en', desde.toISOString())
    .lt('creado_en', hasta.toISOString())
    .in('pago_estado', PAGOS_VISIBLES)
    .order('creado_en', { ascending: false })
    .limit(LIMITE_PEDIDOS_RANGO);
  if (error) throw error;
  return (data as PedidoRow[]).map(pedidoDesdeRow);
}

// RF-11: aceptar, marcar listo, entregado/retirado, rechazar.
export async function cambiarEstadoPedido(id: string, estado: EstadoPedido): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase.from('pedidos').update({ estado }).eq('id', id);
  if (error) throw error;
}

// 'pagado': se aprobó el pago de un pedido que todavía no se aceptó; para
// recepción es un pedido nuevo (si no lo tenía ya en pantalla).
export interface EventoPedido {
  tipo: 'nuevo' | 'pagado' | 'actualizado';
  numero: number;
}

type FilaEvento = { numero: number; estado: EstadoPedido; pago_estado?: Pedido['pagoEstado'] };

// RNF-02: escucha los pedidos en tiempo real (WebSocket de Supabase).
export function suscribirPedidos(onEvento: (evento: EventoPedido) => void): () => void {
  if (!supabaseConfigurado) return () => {};
  const canal = supabase
    .channel(`pedidos-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: ESQUEMA, table: 'pedidos' }, (payload) => {
      const fila = payload.new as FilaEvento;
      const visible = PAGOS_VISIBLES.includes(fila.pago_estado ?? 'no_aplica');
      onEvento({ tipo: visible ? 'nuevo' : 'actualizado', numero: fila.numero });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: ESQUEMA, table: 'pedidos' }, (payload) => {
      const fila = payload.new as FilaEvento;
      const pagado = fila.pago_estado === 'aprobado' && fila.estado === 'por_aceptar';
      onEvento({ tipo: pagado ? 'pagado' : 'actualizado', numero: fila.numero });
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(canal);
  };
}
