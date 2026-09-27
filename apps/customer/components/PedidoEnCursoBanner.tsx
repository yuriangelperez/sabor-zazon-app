import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, Text } from '@sabor/ui';
import { ETIQUETA_ESTADO, numeroPedido } from '@sabor/utils';

import { useMisPedidos } from '../hooks/useMisPedidos';
import { Contenedor } from './Contenedor';

// Acceso rápido al seguimiento mientras haya un pedido en curso. Si no hay
// ninguno no ocupa lugar.
export function PedidoEnCursoBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const { enCurso } = useMisPedidos();
  const pedido = enCurso[0];
  if (!pedido?.seguimiento) return null;

  const hayMas = enCurso.length > 1;

  return (
    <Contenedor style={style}>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          hayMas
            ? router.push('/mis-pedidos')
            : router.push({ pathname: '/pedido/[id]', params: { id: pedido.id, c: pedido.codigo } })
        }
        style={styles.banner}
      >
        <Ionicons name="time-outline" size={22} color={colors.sobreAcento} />
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>
            {hayMas ? `Tenés ${enCurso.length} pedidos en curso` : `Tu pedido ${numeroPedido(pedido.numero)}`}
          </Text>
          {!hayMas ? <Text style={styles.estado}>{ETIQUETA_ESTADO[pedido.seguimiento.estado]}</Text> : null}
        </View>
        <Text style={styles.ver}>Ver estado</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.sobreAcento} />
      </Pressable>
    </Contenedor>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.acento,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  titulo: { color: colors.sobreAcento, fontSize: 15, fontWeight: '700' },
  estado: { color: colors.sobreAcento, fontSize: 13 },
  ver: { color: colors.sobreAcento, fontSize: 14, fontWeight: '700' },
});
