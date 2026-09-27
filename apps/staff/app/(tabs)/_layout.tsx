import { useEffect } from 'react';
import { View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, EncabezadoBandera, fonts } from '@sabor/ui';

import { AvisoNuevoPedido } from '../../components/AvisoNuevoPedido';
import { activarAvisos, useAbrirPedidosAlTocarAviso } from '../../services/notificaciones';
import { usePedidosEnVivo, usePedidosEnVivoStore } from '../../stores/usePedidosEnVivo';

type Icono = keyof typeof Ionicons.glyphMap;

function iconoTab(nombre: Icono) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={nombre} size={size} color={color} />;
}

export default function TabsLayout() {
  usePedidosEnVivo();

  // Push de pedidos nuevos: registra este celular y, al tocar un aviso,
  // abre la pestaña de pedidos.
  useAbrirPedidosAlTocarAviso();
  useEffect(() => {
    void activarAvisos();
  }, []);
  const porAceptar = usePedidosEnVivoStore((s) => s.pedidos.filter((p) => p.estado === 'por_aceptar').length);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          header: ({ options }) => <EncabezadoBandera titulo={options.title} />,
          sceneStyle: { backgroundColor: colors.background },
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.acento,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Pedidos en curso',
            tabBarLabel: 'Pedidos',
            tabBarIcon: iconoTab('receipt-outline'),
            tabBarBadge: porAceptar > 0 ? porAceptar : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.rojo, color: '#fff', fontFamily: fonts.bold },
          }}
        />
        <Tabs.Screen name="menu" options={{ title: 'Menú', tabBarIcon: iconoTab('fast-food-outline') }} />
        <Tabs.Screen name="resumen" options={{ title: 'Resumen del día', tabBarLabel: 'Resumen', tabBarIcon: iconoTab('stats-chart-outline') }} />
        <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', tabBarIcon: iconoTab('settings-outline') }} />
      </Tabs>
      <AvisoNuevoPedido />
    </View>
  );
}
