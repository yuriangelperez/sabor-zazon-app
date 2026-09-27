import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors, EncabezadoBandera, useFuentesSabor } from '@sabor/ui';

export default function RootLayout() {
  const fuentesListas = useFuentesSabor();

  if (!fuentesListas) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
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
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)/ventas" options={{ title: 'Sabor y Sazón · Panel' }} />
      </Stack>
    </>
  );
}
