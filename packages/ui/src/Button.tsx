import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, radii, spacing } from './theme';

type Variante = 'primario' | 'secundario' | 'contorno';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variante?: Variante;
  disabled?: boolean;
  icono?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const fondo: Record<Variante, string> = {
  primario: colors.acento,
  secundario: colors.azul,
  contorno: 'transparent',
};

const texto: Record<Variante, string> = {
  primario: colors.sobreAcento,
  secundario: colors.textPrimary,
  contorno: colors.acento,
};

export function Button({
  label,
  onPress,
  variante = 'primario',
  disabled = false,
  icono,
  style,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        { backgroundColor: fondo[variante] },
        variante === 'contorno' && styles.contorno,
        pressed && styles.presionado,
        disabled && styles.deshabilitado,
        style,
      ]}
    >
      {icono}
      <Text style={[styles.label, { color: texto[variante] }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radii.md,
  },
  contorno: { borderWidth: 1.5, borderColor: colors.acento },
  presionado: { opacity: 0.85 },
  deshabilitado: { opacity: 0.4 },
  label: { fontSize: 16, fontWeight: '700' },
});
