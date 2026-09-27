import type { ImagenProducto } from './producto';

export interface OpcionElegida {
  grupoId: string;
  grupoNombre: string;
  opcionId: string;
  nombre: string;
  cantidad: number;
  precioAdicional: number; // por unidad de la opción
}

export interface ItemCarrito {
  key: string; // productoId + opciones elegidas: mismo producto con distintas opciones = ítems distintos
  productoId: string;
  nombre: string;
  imagen: ImagenProducto;
  precioUnitario: number; // precio con descuento + adicionales de las opciones
  cantidad: number;
  opcionesElegidas: OpcionElegida[];
  acompañamientos?: string[];
  observaciones?: string;
}

export type MetodoEntrega = 'delivery' | 'retiro_local';

export type MetodoPago =
  | 'tarjeta'
  | 'billetera_virtual_checkout'
  | 'billetera_virtual_alias'
  | 'efectivo';

// Pago online (Mercado Pago). 'no_aplica': efectivo o transferencia.
// Un pedido con pago 'pendiente' o 'rechazado' no le aparece a recepción.
export type PagoEstado = 'no_aplica' | 'pendiente' | 'aprobado' | 'rechazado' | 'reembolsado';

// Métodos que se cobran con Mercado Pago (Checkout Pro).
export const METODOS_MERCADO_PAGO: MetodoPago[] = ['tarjeta', 'billetera_virtual_checkout'];

// Pagos con los que recepción ve el pedido.
export const PAGOS_VISIBLES: PagoEstado[] = ['no_aplica', 'aprobado', 'reembolsado'];

export type EstadoPedido =
  | 'por_aceptar'
  | 'en_preparacion'
  | 'listo'
  | 'entregado'
  | 'cancelado'
  | 'rechazado';

// Estados que siguen en curso (se ven en el tablero de recepción).
export const ESTADOS_ACTIVOS: EstadoPedido[] = ['por_aceptar', 'en_preparacion', 'listo'];

export interface ItemPedido {
  id: number;
  productoId: string | null;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  opciones: OpcionElegida[];
  acompañamientos: string[];
}

export interface Pedido {
  id: string;
  numero: number;
  estado: EstadoPedido;
  nombreCliente: string;
  celularCliente: string;
  metodoEntrega: MetodoEntrega;
  zonaEnvioId: string | null;
  direccionEntrega: string | null;
  costoEnvio: number;
  metodoPago: MetodoPago;
  pagoEstado: PagoEstado;
  subtotal: number;
  recargo: number;
  descuento: number;
  propina: number;
  total: number;
  observaciones: string | null;
  creadoEn: string; // ISO
  aceptadoEn: string | null;
  listoEn: string | null;
  entregadoEn: string | null;
  canceladoEn: string | null;
  items: ItemPedido[];
}

// Lo que manda el checkout. Los precios NO viajan: la base de datos los
// recalcula a partir de los productos para que nadie pueda alterarlos.
export interface NuevoPedido {
  nombreCliente: string;
  celularCliente: string;
  metodoEntrega: MetodoEntrega;
  zonaEnvioId?: string;
  direccionEntrega?: string;
  metodoPago: MetodoPago;
  observaciones?: string;
  terminosAceptados: boolean;
  items: { productoId: string; cantidad: number; opciones: { grupoId: string; opcionId: string; cantidad: number }[] }[];
}

export interface PedidoCreado {
  id: string;
  numero: number;
  codigoSeguimiento: string;
  total: number;
}

export interface Cupon {
  codigo: string;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valor: number;
  fechaVencimiento: string; // ISO
  limiteUsos: number;
  usosActuales: number;
}
