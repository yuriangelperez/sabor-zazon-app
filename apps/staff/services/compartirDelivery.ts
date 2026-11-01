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

// "Pedido listo": abre WhatsApp con el mensaje armado; quien lo toca solo tiene que enviarlo.
const urlWhatsapp = (mensaje: string, numero?: string) =>
  `https://wa.me/${numero ?? ''}?text=${encodeURIComponent(mensaje)}`;

export function mensajeClienteListo(pedido: Pedido) {
  const detalle =
    pedido.metodoEntrega === 'delivery' ? 'Sale en camino a tu dirección.' : 'Ya podés pasar a retirarlo por el local.';
  return `¡Hola ${pedido.nombreCliente}! Tu pedido de Sabor y Sazón está listo 🎉 ${detalle}`;
}

export const avisarClienteListo = (pedido: Pedido) =>
  Linking.openURL(urlWhatsapp(mensajeClienteListo(pedido), pedido.celularCliente.replace(/\D/g, '')));

/** Avisa al repartidor (con su número guardado, o eligiendo el contacto si no hay). */
export const avisarDeliveryListo = (pedido: Pedido, numeroRepartidor?: string) =>
  Linking.openURL(urlWhatsapp(`${mensajeDelivery(pedido)}\n\n✅ El pedido está listo para retirar.`, numeroRepartidor || undefined));
