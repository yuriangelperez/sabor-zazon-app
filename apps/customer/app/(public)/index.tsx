import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { colors, spacing, typography } from '@sabor/ui';

// Landing: vidriera de productos del restaurante (RF-01).
// El botón "Ver menú" redirige al flujo de pedidos en (shop)/menu.
export default function Landing() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' }}>
      <Text style={{ ...typography.h1, color: colors.textPrimary, marginBottom: spacing.md }}>
        Sabor y Sazón
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg }}>
        Arepas, tequeños, empanadas y más — pedí directo desde acá.
      </Text>
      <Link href="/menu" asChild>
        <Pressable style={{ backgroundColor: colors.amarillo, padding: spacing.md, borderRadius: 12 }}>
          <Text style={{ ...typography.body, color: colors.negro, textAlign: 'center', fontWeight: '700' }}>
            Ver menú
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
