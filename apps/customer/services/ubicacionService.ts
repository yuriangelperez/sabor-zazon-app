import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

/**
 * Coordenadas de una dirección escrita, para mostrarla en el mapa de la app.
 * Primero prueba el geocoder del celular y si no encuentra nada usa Nominatim (OpenStreetMap).
 */
export async function buscarCoordenadas(direccion: string): Promise<{ latitud: number; longitud: number } | null> {
  const consulta = direccion.trim();
  if (!consulta) {
    return null;
  }

  if (Platform.OS !== 'web') {
    try {
      const [lugar] = await Location.geocodeAsync(consulta);
      if (lugar) {
        return { latitud: lugar.latitude, longitud: lugar.longitude };
      }
    } catch {
      // Sigue con Nominatim.
    }
  }

  try {
    const respuesta = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=es&q=${encodeURIComponent(consulta)}`,
    );
    const [lugar] = (await respuesta.json()) as { lat: string; lon: string }[];
    return lugar ? { latitud: Number(lugar.lat), longitud: Number(lugar.lon) } : null;
  } catch {
    return null;
  }
}

/** Abre Google Maps buscando la dirección: pestaña nueva en web, app de mapas en el celular. */
export function abrirDireccionEnMapa(direccion: string) {
  const consulta = direccion.trim();
  if (!consulta) {
    return Promise.resolve();
  }

  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
  // En web, Linking.openURL abre una pestaña nueva.
  return Linking.openURL(url);
}
