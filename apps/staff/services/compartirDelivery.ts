import { Linking, Platform, Share } from 'react-native';
import type { Pedido } from '@sabor/types';
import { consultaCompleta, urlGoogleMaps } from '@sabor/ui';

import { CONTEXTO_MAPA } from '../constants/mapa';

/** Texto para el repartidor: cliente, celular, dirección escrita, link de Google Maps y observaciones. */
export function mensajeDelivery(pedido: Pedido) {
  const direccion = (pedido.direccionEntrega ?? '').trim();
  const lineas = [
    '🛵 Entrega Sabor y Sazón',
    `Nombre: ${pedido.nombreCliente}`,
    `Celular: ${pedido.celularCliente}`,
    `Dirección: ${direccion}`,
    `Mapa: ${urlGoogleMaps(consultaCompleta(direccion, CONTEXTO_MAPA))}`,
  ];
  if (pedido.observaciones?.trim()) {
    lineas.push(`Observaciones: ${pedido.observaciones.trim()}`);
  }
  return lineas.join('\n');
}

/** Abre el menú de compartir del celular (WhatsApp, etc.); en web sin soporte, WhatsApp Web. */
export async function compartirConDelivery(pedido: Pedido) {
  const message = mensajeDelivery(pedido);
  try {
    await Share.share({ message });
  } catch {
    if (Platform.OS === 'web') {
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
    }
  }
}
