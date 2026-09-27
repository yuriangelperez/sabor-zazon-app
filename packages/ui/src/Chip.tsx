import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { colors, radii, spacing } from './theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

// Etiqueta seleccionable para los filtros del menú (categorías, rellenos).
export function Chip({ label, selected = false, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.acento,
    borderColor: colors.acento,
  },
  label: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  labelSelected: { color: colors.sobreAcento },
});
