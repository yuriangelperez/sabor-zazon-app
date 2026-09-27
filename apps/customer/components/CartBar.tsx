import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, Text } from '@sabor/ui';
import { formatPrice } from '@sabor/utils';

import { selectCantidadTotal, selectSubtotal, useCarritoStore } from '../stores/useCarritoStore';
import { ANCHO_MAXIMO } from './Contenedor';

// Barra flotante con el resumen del carrito; aparece al agregar el primer producto.
export function CartBar() {
  const cantidad = useCarritoStore(selectCantidadTotal);
  const subtotal = useCarritoStore(selectSubtotal);
  const insets = useSafeAreaInsets();

  if (cantidad === 0) return null;

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + spacing.sm }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver pedido, ${cantidad} productos`}
        onPress={() => router.push('/carrito')}
        style={styles.barra}
      >
        <View style={styles.contador}>
          <Text style={styles.contadorTexto}>{cantidad}</Text>
        </View>
        <Text style={styles.texto}>Ver pedido</Text>
        <Text style={styles.total}>{formatPrice(subtotal)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.sobreAcento} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  barra: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO - spacing.md * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.acento,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  contador: {
    backgroundColor: colors.sobreAcento,
    borderRadius: radii.pill,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  contadorTexto: { color: colors.acento, fontWeight: '800' },
  texto: { flex: 1, color: colors.sobreAcento, fontWeight: '700', fontSize: 16 },
  total: { color: colors.sobreAcento, fontWeight: '800', fontSize: 16 },
});
