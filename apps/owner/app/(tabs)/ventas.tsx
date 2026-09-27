import { View, Text } from 'react-native';
import { colors, spacing, typography } from '@sabor/ui';

// RF-15 / RF-16: resumen de ventas con filtros de fecha y gráficos.
export default function Ventas() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <Text style={{ ...typography.h2, color: colors.textPrimary }}>Ventas</Text>
      {/* TODO: filtros día/semana/mes/año/personalizado + gráfico */}
    </View>
  );
}
