import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { colors, radii, spacing } from './theme';

interface EncabezadoBanderaProps {
  titulo?: string;
  logo?: ImageSourcePropType;
  onVolver?: () => void;
  derecha?: ReactNode;
}

// Barra superior con los colores de la bandera de Venezuela, igual a la
// navbar de la landing: franjas diagonales amarillo / azul / rojo y las
// siete estrellas en el centro (solo en pantallas anchas).
export function EncabezadoBandera({ titulo, logo, onVolver, derecha }: EncabezadoBanderaProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <View style={[styles.barra, { paddingTop: insets.top + spacing.sm }]}>
      {/* Franjas: el fondo es rojo y encima van el azul y el amarillo inclinados */}
      <View style={[styles.franja, styles.franjaAzul]} />
      <View style={[styles.franja, styles.franjaAmarilla]} />
      {width >= 768 ? (
        <Text style={styles.estrellas} accessibilityElementsHidden importantForAccessibility="no">
          ★ ★ ★ ★ ★ ★ ★
        </Text>
      ) : null}

      <View style={styles.contenido}>
        {onVolver ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onVolver} style={styles.boton} hitSlop={6}>
            <Text style={styles.botonIcono}>‹</Text>
          </Pressable>
        ) : null}
        {logo ? <Image source={logo} style={styles.logo} /> : null}
        {titulo ? (
          <Text style={styles.titulo} numberOfLines={1}>
            {titulo}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {derecha}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    backgroundColor: colors.rojo,
    borderBottomWidth: 2,
    borderBottomColor: colors.negro,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  // Cada franja arranca fuera de pantalla a la izquierda y termina (en su
  // punto medio vertical) en el mismo % que el degradé de 115° de la web.
  franja: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -80,
    transform: [{ skewX: '-24deg' }],
  },
  franjaAzul: { right: '32%', backgroundColor: colors.azul },
  franjaAmarilla: { right: '65%', backgroundColor: colors.amarillo },
  estrellas: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.94)',
    fontSize: 13,
    letterSpacing: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  contenido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
  },
  boton: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonIcono: { color: colors.textPrimary, fontSize: 30, lineHeight: 34, fontWeight: '400' },
  logo: { width: 42, height: 42, borderRadius: 21 },
  titulo: {
    flex: 1,
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,1)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
});
