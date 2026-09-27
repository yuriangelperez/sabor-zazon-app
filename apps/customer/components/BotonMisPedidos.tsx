import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '@sabor/ui';

import { usePedidosStore } from '../stores/usePedidosStore';

// Acceso a "Mis pedidos" desde el encabezado; aparece tras el primer pedido.
export function BotonMisPedidos() {
  const hayPedidos = usePedidosStore((s) => s.pedidos.length > 0);
  if (!hayPedidos) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Mis pedidos"
      onPress={() => router.push('/mis-pedidos')}
      style={styles.boton}
      hitSlop={6}
    >
      <Ionicons name="receipt-outline" size={22} color={colors.textPrimary} />
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
});
