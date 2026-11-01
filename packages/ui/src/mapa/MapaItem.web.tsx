import { StyleSheet, View } from 'react-native';
import { colors, radii } from '../theme';

import { urlMapaOsm } from './mapaOsm';

interface MapaItemProps {
  latitud: number;
  longitud: number;
  titulo?: string;
}

// En el navegador no hay WebView: el mismo mapa de OpenStreetMap va en un iframe.
export function MapaItem({ latitud, longitud, titulo }: MapaItemProps) {
  return (
    <View style={styles.contenedor} testID="mapa-item">
      <iframe
        title={titulo ?? 'Mapa'}
        src={urlMapaOsm(latitud, longitud)}
        style={{ border: 0, width: '100%', height: '100%' }}
        loading="lazy"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    height: 180,
    alignSelf: 'stretch',
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
});
