import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors, spacing } from '../theme';
import { MapaItem } from './MapaItem';
import { abrirDireccionEnMapa, buscarCoordenadas, consultaCompleta } from './ubicacion';

interface VerEnMapaProps {
  /** Dirección en texto (ej. "San Ignacio 663"); si está vacía no se muestra nada. */
  direccion: string;
  /** Ciudad/provincia que se agrega a la búsqueda si la dirección no la trae (ej. "Pilar, Buenos Aires, Argentina"). */
  contexto?: string;
  /** Coordenadas ya conocidas: se usan directo, sin buscar la dirección. */
  coordenadas?: { latitud: number; longitud: number } | null;
  /** Texto exacto para "Abrir en Google Maps" (si no, se usa la dirección con su contexto). */
  direccionGoogle?: string;
  /** Muestra el mapa abierto desde el principio. */
  abiertoInicial?: boolean;
  /** Cambiarlo abre el mapa y lo vuelve a buscar (p. ej. al tocar Enter en el campo). */
  pedido?: number;
}

// Espera a que se deje de escribir antes de buscar (Nominatim pide no más de 1 por segundo).
const ESPERA_MS = 700;

/**
 * "Ver en el mapa": el mapa de OpenStreetMap se arma buscando la dirección escrita,
 * y "Abrir en Google Maps" abre Google Maps con esa misma dirección en texto.
 */
export function VerEnMapa({ direccion, contexto, coordenadas = null, direccionGoogle, abiertoInicial = false, pedido = 0 }: VerEnMapaProps) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [pedidoVisto, setPedidoVisto] = useState(pedido);
  const [buscando, setBuscando] = useState(false);
  const [punto, setPunto] = useState(coordenadas);
  const [sinResultado, setSinResultado] = useState(false);
  const consulta = consultaCompleta(direccion, contexto);
  const puntoMostrado = coordenadas ?? punto;

  if (pedido !== pedidoVisto) {
    setPedidoVisto(pedido);
    setAbierto(true);
  }

  useEffect(() => {
    if (!abierto || !consulta || coordenadas) {
      return;
    }

    let cancelado = false;
    const espera = setTimeout(async () => {
      setBuscando(true);
      const resultado = await buscarCoordenadas(consulta);
      if (cancelado) {
        return;
      }
      setBuscando(false);
      setPunto(resultado);
      setSinResultado(!resultado);
    }, ESPERA_MS);

    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [abierto, consulta, coordenadas, pedidoVisto]);

  if (!consulta) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <Pressable accessibilityRole="link" onPress={() => setAbierto(!abierto)} style={styles.link}>
        <Text style={styles.texto}>{abierto ? 'Ocultar mapa' : 'Ver en el mapa'}</Text>
      </Pressable>

      {abierto ? (
        <>
          {puntoMostrado && !sinResultado ? <MapaItem latitud={puntoMostrado.latitud} longitud={puntoMostrado.longitud} titulo={consulta} /> : null}
          {buscando ? <ActivityIndicator size="small" color={colors.acento} /> : null}
          {sinResultado && !buscando ? (
            <Text style={styles.hint}>No encontramos esa dirección en el mapa. Revisá cómo está escrita.</Text>
          ) : null}
          <Pressable accessibilityRole="link" onPress={() => void abrirDireccionEnMapa(direccionGoogle ?? consulta)} style={styles.link}>
            <Text style={styles.secundario}>Abrir en Google Maps</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs + 2, alignSelf: 'stretch' },
  link: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  texto: { color: colors.acento, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  secundario: { color: colors.textSecondary, fontSize: 14, textDecorationLine: 'underline' },
  hint: { color: colors.textMuted, fontSize: 13 },
});
