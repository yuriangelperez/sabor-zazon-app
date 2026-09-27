import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '@sabor/ui';

export const ANCHO_MAXIMO = 1100;

// Mobile-first (RNF-01): en celular ocupa todo el ancho y en la web se
// centra con un ancho máximo para que no se estire en monitores grandes.
export function Contenedor({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.contenedor, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  contenedor: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
  },
});
