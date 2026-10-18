// Configuración del local (tabla `configuracion`, una sola fila).
export interface ConfiguracionLocal {
  pausado: boolean; // RF-13: recepción pausada a mano ("cerrar tienda")
  pausadoHasta: string | null; // ISO: el cierre manual vence en la próxima apertura
  mensajePausa: string | null;
  horarioApertura: string; // "HH:mm"
  horarioCierre: string; // "HH:mm"
  direccionLocal: string;
  aliasTransferencia: string | null;
  cvu: string | null;
  titularCuenta: string | null;
  recargoLinkPago: number; // % que se suma al pagar con tarjeta o link
  // Envío por km: base + porKm × km (la base de datos redondea a $100).
  deliveryActivo: boolean;
  envioBase: number;
  envioPorKm: number;
  envioKmMaximo: number; // no se hace delivery más lejos (distancia por calle)
}

export type TarifaEnvio = Pick<ConfiguracionLocal, 'deliveryActivo' | 'envioBase' | 'envioPorKm' | 'envioKmMaximo'>;

// Dirección medida por la Edge Function `cotizar-envio` (OpenStreetMap).
export interface CotizacionEnvio {
  id: string; // se manda al crear el pedido
  direccion: string; // cómo la encontró el mapa, para que el cliente la confirme
  distanciaKm: number;
  costo: number;
}
