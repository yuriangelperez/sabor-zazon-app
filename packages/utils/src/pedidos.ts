import type { EstadoPedido, MetodoEntrega, MetodoPago, PagoEstado } from '@sabor/types';

// "#0042": así se muestra el número de orden en todas las apps.
export function numeroPedido(numero: number): string {
  return `#${String(numero).padStart(4, '0')}`;
}

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  por_aceptar: 'Por aceptar',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  rechazado: 'Rechazado',
};

export const ETIQUETA_ENTREGA: Record<MetodoEntrega, string> = {
  delivery: 'Delivery',
  retiro_local: 'Retiro en el local',
};

export const ETIQUETA_PAGO: Record<MetodoPago, string> = {
  tarjeta: 'Tarjeta (Mercado Pago)',
  billetera_virtual_checkout: 'Mercado Pago',
  billetera_virtual_alias: 'Transferencia',
  efectivo: 'Efectivo',
};

export const ETIQUETA_PAGO_ESTADO: Record<PagoEstado, string> = {
  no_aplica: '',
  pendiente: 'Falta pagar',
  aprobado: 'Pagado',
  rechazado: 'Pago rechazado',
  reembolsado: 'Reembolsado',
};

// Lo que ve el cliente: mientras no pague, el pedido está "Falta pagar".
export function etiquetaSeguimiento(estado: EstadoPedido, pagoEstado: PagoEstado): string {
  if ((pagoEstado === 'pendiente' || pagoEstado === 'rechazado') && estado === 'por_aceptar') {
    return ETIQUETA_PAGO_ESTADO[pagoEstado];
  }
  return ETIQUETA_ESTADO[estado];
}

export function faltaPagar(pagoEstado: PagoEstado): boolean {
  return pagoEstado === 'pendiente' || pagoEstado === 'rechazado';
}

// "hace 5 min", "hace 1 h 10 min": antigüedad de un pedido en el tablero.
export function tiempoTranscurrido(desdeIso: string, ahora: Date = new Date()): string {
  const minutos = Math.max(0, Math.floor((ahora.getTime() - new Date(desdeIso).getTime()) / 60_000));
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `hace ${horas} h ${resto} min` : `hace ${horas} h`;
}

export function horaCorta(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
