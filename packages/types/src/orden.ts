export interface ItemCarrito {
  productoId: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  opcionesElegidas?: { opcionId: string; nombre: string; precioAdicional: number }[];
  acompañamientos?: string[];
  observaciones?: string;
}

export type MetodoEntrega = 'delivery' | 'retiro_local';

export type MetodoPago =
  | 'tarjeta'
  | 'billetera_virtual_checkout'
  | 'billetera_virtual_alias'
  | 'efectivo';

export type EstadoOrden =
  | 'por_aceptar'
  | 'en_preparacion'
  | 'listo'
  | 'entregado'
  | 'cancelado';

export interface Orden {
  id: string;
  numeroOrden: string;
  compradorId?: string; // opcional: puede ser invitado
  nombreComprador: string;
  celularComprador: string;
  items: ItemCarrito[];
  metodoEntrega: MetodoEntrega;
  direccionEntrega?: string;
  costoEnvio: number; // 0 si es retiro en local
  cuponCodigo?: string;
  descuentoAplicado?: number;
  propina?: number;
  total: number;
  metodoPago: MetodoPago;
  observaciones?: string;
  estado: EstadoOrden;
  terminosAceptados: boolean;
  horaInicio: string; // ISO
  reembolsoPorcentaje?: 70 | 100; // regla de cancelación
}

export interface Cupon {
  codigo: string;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valor: number;
  fechaVencimiento: string; // ISO
  limiteUsos: number;
  usosActuales: number;
}
