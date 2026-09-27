import { StyleSheet, View } from 'react-native';
import { colors, spacing, Text } from '@sabor/ui';

import { useLocal } from '../hooks/useLocal';

// RF-07: aviso de local cerrado antes y durante la compra. Contempla el
// horario y la pausa manual de recepción (RF-13), en tiempo real.
export function EstadoLocalBanner() {
  const { config, abierto } = useLocal();
  if (!config || abierto) return null;

  const texto = config.pausado
    ? (config.mensajePausa ?? 'En este momento no estamos tomando pedidos. Volvé a intentar en un rato.')
    : `El local está cerrado por el momento. Horario de atención: ${config.horarioApertura} a ${config.horarioCierre} hs.`;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.cerrado,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  texto: { color: colors.textPrimary, textAlign: 'center', fontWeight: '600', fontSize: 13 },
});
