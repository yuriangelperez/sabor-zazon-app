import { View, Text } from 'react-native';
import { colors, spacing, typography } from '@sabor/ui';

// RF-01 / RF-02 / RF-03: catálogo, búsqueda, filtros y agregado rápido al carrito.
export default function Menu() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <Text style={{ ...typography.h2, color: colors.textPrimary }}>Menú</Text>
      {/* TODO: buscador, CategoryTabs, RellenoFilter, FlatList de ProductCard */}
    </View>
  );
}
