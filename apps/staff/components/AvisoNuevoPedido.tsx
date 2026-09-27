import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, Text } from '@sabor/ui';
import { numeroPedido } from '@sabor/utils';

import { usePedidosEnVivoStore } from '../stores/usePedidosEnVivo';

// RF-11: alerta visual ante cada pedido nuevo (acompaña al sonido).
export function AvisoNuevoPedido() {
  const numero = usePedidosEnVivoStore((s) => s.ultimoNuevo);
  const descartar = usePedidosEnVivoStore((s) => s.descartarAviso);
  const insets = useSafeAreaInsets();
  const pulso = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (numero == null) return;
    const animacion = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1.04, duration: 450, useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 1, duration: 450, useNativeDriver: true }),
      ])
    );
    animacion.start();
    const cierre = setTimeout(descartar, 15_000);
    return () => {
      animacion.stop();
      clearTimeout(cierre);
    };
  }, [numero, pulso, descartar]);

  if (numero == null) return null;

  return (
    <Animated.View style={[styles.contenedor, { top: insets.top + 70, transform: [{ scale: pulso }] }]}>
      <Pressable
        accessibilityRole="alert"
        onPress={() => {
          descartar();
          router.navigate('/');
        }}
        style={styles.aviso}
      >
        <Ionicons name="notifications" size={24} color={colors.sobreAcento} />
        <Text style={styles.texto}>¡Nuevo pedido {numeroPedido(numero)}!</Text>
        <Text style={styles.ver}>Ver</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contenedor: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center' },
  aviso: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.acento,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  texto: { flex: 1, color: colors.sobreAcento, fontSize: 17, fontWeight: '700' },
  ver: { color: colors.sobreAcento, fontWeight: '700', textDecorationLine: 'underline' },
});
