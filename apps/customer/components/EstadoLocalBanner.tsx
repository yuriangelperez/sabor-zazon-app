import { StyleSheet, View } from 'react-native';
import { colors, spacing, Text } from '@sabor/ui';
import { describirMomento, pausaVigente } from '@sabor/utils';

import { useLocal } from '../hooks/useLocal';

// RF-07: aviso de local cerrado antes y durante la compra. Contempla el
// horario y la pausa manual de recepción (RF-13), en tiempo real.
export function EstadoLocalBanner() {
  const { config, abierto } = useLocal();
  if (!config || abierto) return null;

  const vuelve = config.pausadoHasta ? ` Volvemos a tomar pedidos ${describirMomento(config.pausadoHasta)}.` : '';
  const texto = pausaVigente(config)
    ? `${config.mensajePausa ?? 'En este momento no estamos tomando pedidos.'}${vuelve}`
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
