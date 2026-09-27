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
}

export interface ZonaEnvio {
  id: string;
  nombre: string;
  costo: number;
  activa: boolean;
}
