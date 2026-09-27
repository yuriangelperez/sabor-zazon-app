import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors, EncabezadoBandera, useFuentesSabor } from '@sabor/ui';

import { BotonCarrito } from '../components/BotonCarrito';
import { BotonMisPedidos } from '../components/BotonMisPedidos';

const logo = require('../assets/images/branding/logo.png');

const HOME = 'index';
const CARRITO = '(shop)/carrito';
// Pantallas donde el botón del carrito no aporta (ya estás pagando o pagaste).
const SIN_CARRITO = [CARRITO, '(shop)/checkout', '(shop)/pedido/[id]', '(shop)/mis-pedidos'];

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
          header: ({ options, back, navigation, route }) => {
            // Si se entró directo por un link (ej. desde la landing a un
            // producto) no hay historial: "volver" lleva al home.
            const onVolver = back
              ? navigation.goBack
              : route.name !== HOME
                ? () => router.replace('/')
                : undefined;

            return (
              <EncabezadoBandera
                titulo={options.title}
                logo={onVolver ? undefined : logo}
                onVolver={onVolver}
                derecha={
                  SIN_CARRITO.includes(route.name) ? undefined : (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <BotonMisPedidos />
                      <BotonCarrito />
                    </View>
                  )
                }
              />
            );
          },
        }}
      >
        <Stack.Screen name={HOME} options={{ title: 'Sabor y Sazón' }} />
        <Stack.Screen name="(shop)/menu/index" options={{ title: 'Menú' }} />
        <Stack.Screen name="(shop)/producto/[id]" options={{ title: '' }} />
        <Stack.Screen name={CARRITO} options={{ title: 'Tu pedido' }} />
        <Stack.Screen name="(shop)/checkout" options={{ title: 'Finalizar pedido' }} />
        <Stack.Screen name="(shop)/pedido/[id]" options={{ title: 'Tu pedido' }} />
        <Stack.Screen name="(shop)/mis-pedidos" options={{ title: 'Mis pedidos' }} />
      </Stack>
    </>
  );
}
