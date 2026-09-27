import { View, Text } from 'react-native';
import { colors, spacing, typography } from '@sabor/ui';

// RF-09 / RF-10 / RF-11: tablero por aceptar / en preparación / listos.
export default function Pedidos() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <Text style={{ ...typography.h2, color: colors.textPrimary }}>Pedidos en curso</Text>
      {/* TODO: 3 columnas (por aceptar / en preparación / listos) con OrderCard */}
    </View>
  );
}
