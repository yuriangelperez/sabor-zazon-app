import type {
  CategoriaBase,
  CategoriaMomento,
  ConfiguracionLocal,
  GrupoOpciones,
  ItemPedido,
  OpcionElegida,
  Pedido,
  Producto,
  Relleno,
  ZonaEnvio,
} from '@sabor/types';

// Filas tal como vienen de Postgres (snake_case) y su conversión a los tipos
// de la app (camelCase). Es el único lugar que conoce los nombres de columnas.

export interface ProductoRow {
  id: string;
  nombre: string;
  descripcion: string;
  imagen: string;
  precio: number;
  descuento_porcentaje: number;
  categoria_base: CategoriaBase;
  categorias_momento: CategoriaMomento[];
  rellenos: Relleno[];
  es_combo: boolean;
  grupos_opciones: GrupoOpciones[];
  acompanamientos: string[];
  ingredientes: string[];
  activo: boolean;
  desactivado_hasta: string | null;
  orden: number;
}

export function productoDesdeRow(r: ProductoRow): Producto {
  return {
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    imagen: r.imagen,
    precio: r.precio,
    descuentoPorcentaje: r.descuento_porcentaje,
    categoriaBase: r.categoria_base,
    categoriasMomento: r.categorias_momento ?? [],
    rellenos: r.rellenos ?? [],
    esCombo: r.es_combo,
    gruposOpciones: r.grupos_opciones ?? [],
    acompañamientos: r.acompanamientos ?? [],
    ingredientes: r.ingredientes ?? [],
    activo: r.activo,
    desactivadoHasta: r.desactivado_hasta,
    orden: r.orden,
  };
}

// `agotado` se calcula en la app a partir de los ingredientes: no se guarda.
export function gruposARow(grupos: Producto['gruposOpciones']): ProductoRow['grupos_opciones'] {
  return (grupos ?? []).map((g) => ({
    ...g,
    opciones: g.opciones.map(({ agotado: _agotado, ...o }) => o),
  }));
}

export function productoARow(p: Producto): Omit<ProductoRow, 'id'> & { id?: string } {
  return {
    id: p.id || undefined,
    nombre: p.nombre.trim(),
    descripcion: p.descripcion.trim(),
    imagen: typeof p.imagen === 'string' ? p.imagen : '',
    precio: Math.round(p.precio),
    descuento_porcentaje: Math.round(p.descuentoPorcentaje ?? 0),
    categoria_base: p.categoriaBase,
    categorias_momento: p.categoriasMomento,
    rellenos: p.rellenos ?? [],
    es_combo: p.esCombo,
    grupos_opciones: gruposARow(p.gruposOpciones),
    acompanamientos: p.acompañamientos ?? [],
    ingredientes: p.ingredientes ?? [],
    activo: p.activo,
    desactivado_hasta: p.desactivadoHasta ?? null,
    orden: p.orden ?? 0,
  };
}

export interface ConfiguracionRow {
  pausado: boolean;
  mensaje_pausa: string | null;
  horario_apertura: string; // "10:00:00"
  horario_cierre: string;
  direccion_local: string;
  alias_transferencia: string | null;
  cvu: string | null;
  titular_cuenta: string | null;
  recargo_link_pago: number | string;
}

export function configuracionDesdeRow(r: ConfiguracionRow): ConfiguracionLocal {
  return {
    pausado: r.pausado,
    mensajePausa: r.mensaje_pausa,
    horarioApertura: r.horario_apertura.slice(0, 5),
    horarioCierre: r.horario_cierre.slice(0, 5),
    direccionLocal: r.direccion_local,
    aliasTransferencia: r.alias_transferencia,
    cvu: r.cvu,
    titularCuenta: r.titular_cuenta,
    recargoLinkPago: Number(r.recargo_link_pago),
  };
}

export interface ZonaRow {
  id: string;
  nombre: string;
  costo: number;
  activa: boolean;
}

export function zonaDesdeRow(r: ZonaRow): ZonaEnvio {
  return { id: r.id, nombre: r.nombre, costo: r.costo, activa: r.activa };
}

export interface ItemPedidoRow {
  id: number;
  producto_id: string | null;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  opciones: OpcionElegida[];
  acompanamientos: string[];
}

export interface PedidoRow {
  id: string;
  numero: number;
  estado: Pedido['estado'];
  nombre_cliente: string;
  celular_cliente: string;
  metodo_entrega: Pedido['metodoEntrega'];
  zona_envio_id: string | null;
  direccion_entrega: string | null;
  costo_envio: number;
  metodo_pago: Pedido['metodoPago'];
  pago_estado: Pedido['pagoEstado'];
  subtotal: number;
  recargo: number;
  descuento: number;
  propina: number;
  total: number;
  observaciones: string | null;
  creado_en: string;
  aceptado_en: string | null;
  listo_en: string | null;
  entregado_en: string | null;
  cancelado_en: string | null;
  items_pedido?: ItemPedidoRow[];
}

function itemDesdeRow(r: ItemPedidoRow): ItemPedido {
  return {
    id: r.id,
    productoId: r.producto_id,
    nombre: r.nombre,
    cantidad: r.cantidad,
    precioUnitario: r.precio_unitario,
    opciones: r.opciones ?? [],
    acompañamientos: r.acompanamientos ?? [],
  };
}

export function pedidoDesdeRow(r: PedidoRow): Pedido {
  return {
    id: r.id,
    numero: r.numero,
    estado: r.estado,
    nombreCliente: r.nombre_cliente,
    celularCliente: r.celular_cliente,
    metodoEntrega: r.metodo_entrega,
    zonaEnvioId: r.zona_envio_id,
    direccionEntrega: r.direccion_entrega,
    costoEnvio: r.costo_envio,
    metodoPago: r.metodo_pago,
    pagoEstado: r.pago_estado ?? 'no_aplica',
    subtotal: r.subtotal,
    recargo: r.recargo,
    descuento: r.descuento,
    propina: r.propina,
    total: r.total,
    observaciones: r.observaciones,
    creadoEn: r.creado_en,
    aceptadoEn: r.aceptado_en,
    listoEn: r.listo_en,
    entregadoEn: r.entregado_en,
    canceladoEn: r.cancelado_en,
    items: (r.items_pedido ?? []).sort((a, b) => a.id - b.id).map(itemDesdeRow),
  };
}
