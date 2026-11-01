import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing, Text } from '@sabor/ui';

import { abrirDireccionEnMapa, buscarCoordenadas } from '../services/ubicacionService';
import { MapaItem } from './MapaItem';

interface Props {
  /** Dirección completa a ubicar en el mapa. */
  direccion: string;
  /** Si ya se conocen las coordenadas se usan directo, sin buscar. */
  coordenadas?: { latitud: number; longitud: number } | null;
}

// Mapa del local dentro de la app (como "Ver en el mapa" de newyou-app): busca la
// dirección, dibuja el mapa con el marcador y deja abrirla en Google Maps.
export function MapaLocal({ direccion, coordenadas = null }: Props) {
  const [punto, setPunto] = useState(coordenadas);
  const [buscando, setBuscando] = useState(!coordenadas);
  const [sinResultado, setSinResultado] = useState(false);

  useEffect(() => {
    if (coordenadas) {
      return;
    }
    let cancelado = false;
    void buscarCoordenadas(direccion).then((resultado) => {
      if (cancelado) {
        return;
      }
      setPunto(resultado);
      setSinResultado(!resultado);
      setBuscando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [direccion, coordenadas]);

  return (
    <View style={styles.wrapper}>
      {punto ? <MapaItem latitud={punto.latitud} longitud={punto.longitud} titulo={direccion} /> : null}
      {buscando ? <ActivityIndicator size="small" color={colors.acento} /> : null}
      {sinResultado && !buscando ? <Text style={styles.hint}>No pudimos mostrar el mapa en este momento.</Text> : null}
      <Pressable accessibilityRole="link" onPress={() => void abrirDireccionEnMapa(direccion)} style={styles.link}>
        <Text style={styles.linkTexto}>Abrir en Google Maps</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'stretch', gap: spacing.sm, alignItems: 'center' },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  link: { paddingVertical: spacing.xs },
  linkTexto: { color: colors.acento, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
