import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, Text } from '@sabor/ui';

import { selectCantidadTotal, useCarritoStore } from '../stores/useCarritoStore';

// Acceso al carrito desde el encabezado, con el mismo estilo que el botón
// de menú de la landing.
export function BotonCarrito() {
  const cantidad = useCarritoStore(selectCantidadTotal);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver pedido, ${cantidad} productos`}
      onPress={() => router.push('/carrito')}
      style={styles.boton}
      hitSlop={6}
    >
      <Ionicons name="bag-handle-outline" size={22} color={colors.textPrimary} />
      {cantidad > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeTexto}>{cantidad > 99 ? '99+' : cantidad}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexto: { color: colors.sobreAcento, fontSize: 11, fontWeight: '700', lineHeight: 14 },
});
