import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, radii } from './theme';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

// Selector "-3+" (RF-03 / RF-05 / etiquetas de combos).
export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  size = 'md',
  disabled = false,
}: QuantityStepperProps) {
  const puedeRestar = !disabled && value > min;
  const puedeSumar = !disabled && value < max;
  const dim = size === 'sm' ? 28 : 36;

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Restar uno"
        disabled={!puedeRestar}
        onPress={() => onChange(value - 1)}
        hitSlop={6}
        style={[styles.boton, { width: dim, height: dim }, !puedeRestar && styles.botonInactivo]}
      >
        <Text style={styles.signo}>−</Text>
      </Pressable>
      <Text style={[styles.valor, size === 'sm' && styles.valorSm]}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sumar uno"
        disabled={!puedeSumar}
        onPress={() => onChange(value + 1)}
        hitSlop={6}
        style={[styles.boton, { width: dim, height: dim }, !puedeSumar && styles.botonInactivo]}
      >
        <Text style={styles.signo}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    padding: 2,
  },
  disabled: { opacity: 0.5 },
  boton: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  botonInactivo: { opacity: 0.35 },
  signo: { color: colors.acento, fontSize: 18, fontWeight: '700', lineHeight: 20 },
  valor: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  valorSm: { fontSize: 14, minWidth: 22 },
});
