import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Punto } from '@sabor/types';
import { colors, radii } from '@sabor/ui';

import { htmlMapa, type MapaUbicacionProps, type MensajeMapa } from './htmlMapa';

// Celular: el mapa de Leaflet dentro de un WebView. La web usa
// MapaUbicacion.web.tsx (iframe).
export function MapaUbicacion({ centro, irA, local, zoom, onMensaje }: MapaUbicacionProps) {
  const vista = useRef<WebView>(null);
  // Solo se arma al abrir: después el pin lo mueven el cliente o `irA`.
  const html = useMemo(() => htmlMapa({ centro, local, zoom }), []);

  const moverA = (p: Punto | null) => {
    if (p) vista.current?.injectJavaScript(`window.moverPin && window.moverPin(${p.lat}, ${p.lng}); true;`);
  };
  // Último destino pedido, para mandarlo también cuando termina de cargar.
  const destino = useRef(irA);
  destino.current = irA;
  useEffect(() => moverA(irA), [irA?.lat, irA?.lng]);

  return (
    <View style={styles.marco}>
      <WebView
        ref={vista}
        originWhitelist={['*']}
        source={{ html }}
        geolocationEnabled
        nestedScrollEnabled
        onLoadEnd={() => moverA(destino.current)}
        onMessage={(e) => {
          try {
            onMensaje(JSON.parse(e.nativeEvent.data) as MensajeMapa);
          } catch {
            // mensaje ajeno al mapa
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  marco: { height: 320, borderRadius: radii.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderStrong },
});
