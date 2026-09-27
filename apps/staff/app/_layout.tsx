import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors, EncabezadoBandera, useFuentesSabor } from '@sabor/ui';

import { useSesionStore } from '../stores/useSesionStore';

export default function RootLayout() {
  const fuentesListas = useFuentesSabor();
  const { perfil, iniciando, inicializar } = useSesionStore();

  useEffect(() => inicializar(), [inicializar]);

  if (!fuentesListas || iniciando) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.acento} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          header: ({ options, back, navigation }) => (
            <EncabezadoBandera titulo={options.title} onVolver={back ? navigation.goBack : undefined} />
          ),
        }}
      >
        {/* RF-14: sin sesión de staff solo se puede ver el login */}
        <Stack.Protected guard={perfil != null}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="producto/[id]" options={{ title: 'Producto' }} />
        </Stack.Protected>
        <Stack.Protected guard={perfil == null}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
