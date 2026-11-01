import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radii } from '@sabor/ui';

import { urlMapaOsm } from './mapaOsm';

interface MapaItemProps {
  latitud: number;
  longitud: number;
  titulo?: string;
}

const URL_EMBED = 'https://www.openstreetmap.org/export/embed.html';

// Mapa fijo con un marcador, con OpenStreetMap dentro de un WebView:
// funciona en Expo Go y en el .apk sin clave de Google Maps.
export function MapaItem({ latitud, longitud, titulo }: MapaItemProps) {
  return (
    <View
      style={styles.contenedor}
      testID="mapa-item"
      accessible
      accessibilityLabel={titulo ? `Mapa: ${titulo}` : 'Mapa'}
    >
      <WebView
        source={{ uri: urlMapaOsm(latitud, longitud) }}
        style={styles.mapa}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        // Los enlaces del mapa ("Ver mapa más grande") no navegan dentro de la tarjeta.
        onShouldStartLoadWithRequest={(pedido) => pedido.url.startsWith(URL_EMBED)}
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
  mapa: { flex: 1 },
});
