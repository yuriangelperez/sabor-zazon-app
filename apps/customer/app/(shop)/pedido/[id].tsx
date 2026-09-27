import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { EstadoPedido } from '@sabor/types';
import { mensajeError, verPedido, type SeguimientoPedido } from '@sabor/api-client';
import { acentoAlpha, Button, colors, radii, spacing, Text } from '@sabor/ui';
import { formatPrice, numeroPedido } from '@sabor/utils';

import { Contenedor } from '../../../components/Contenedor';
import { LOCAL, whatsappUrl } from '../../../constants/local';
import { useLocal } from '../../../hooks/useLocal';
import { usePedidosStore } from '../../../stores/usePedidosStore';

const PASOS: { estado: EstadoPedido; titulo: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { estado: 'por_aceptar', titulo: 'Recibido', icono: 'receipt-outline' },
  { estado: 'en_preparacion', titulo: 'En preparación', icono: 'flame-outline' },
  { estado: 'listo', titulo: 'Listo', icono: 'bag-check-outline' },
  { estado: 'entregado', titulo: 'Entregado', icono: 'checkmark-done-outline' },
];

const INTERVALO_MS = 10_000;

// RF-07: confirmación y seguimiento del pedido.
export default function SeguimientoPedidoPantalla() {
  const params = useLocalSearchParams<{ id: string; c?: string }>();
  const guardado = usePedidosStore((s) => s.pedidos.find((p) => p.id === params.id));
  const codigo = params.c ?? guardado?.codigo;
  const { config } = useLocal();
  const insets = useSafeAreaInsets();
  const [pedido, setPedido] = useState<SeguimientoPedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!params.id || !codigo) {
      setError('No encontramos este pedido.');
      setCargando(false);
      return;
    }
    try {
      const datos = await verPedido(params.id, codigo);
      if (!datos) setError('No encontramos este pedido.');
      else {
        setPedido(datos);
        setError(null);
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, [params.id, codigo]);

  useEffect(() => {
    void cargar();
    const intervalo = setInterval(() => void cargar(), INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  if (cargando) return <ActivityIndicator color={colors.acento} style={{ marginTop: spacing.xl }} />;

  if (!pedido) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.textoSecundario}>{error}</Text>
        <Button label="Volver al inicio" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const cancelado = pedido.estado === 'cancelado' || pedido.estado === 'rechazado';
  const indiceActual = PASOS.findIndex((p) => p.estado === pedido.estado);
  const mensajeWhatsapp = `¡Hola! Te escribo por mi pedido ${numeroPedido(pedido.numero)}.`;

  return (
    <View style={styles.pantalla}>
      <Stack.Screen options={{ title: `Pedido ${numeroPedido(pedido.numero)}` }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <Contenedor style={styles.contenido}>
          <View style={styles.cabecera}>
            <Ionicons
              name={cancelado ? 'close-circle' : 'checkmark-circle'}
              size={56}
              color={cancelado ? colors.danger : colors.success}
            />
            <Text style={styles.titulo}>{cancelado ? 'Pedido cancelado' : '¡Recibimos tu pedido!'}</Text>
            <Text style={styles.numero}>{numeroPedido(pedido.numero)}</Text>
            <Text style={styles.textoSecundario}>
              {cancelado
                ? 'Si tenés dudas, escribinos por WhatsApp.'
                : 'Esta pantalla se actualiza sola a medida que avanza tu pedido.'}
            </Text>
          </View>

          {!cancelado ? (
            <View style={styles.tarjeta}>
              {PASOS.map((paso, i) => {
                const hecho = i <= indiceActual;
                const actual = i === indiceActual;
                const titulo =
                  paso.estado === 'entregado' && pedido.metodoEntrega === 'retiro_local' ? 'Retirado' : paso.titulo;
                return (
                  <View key={paso.estado} style={styles.paso}>
                    <View style={[styles.pasoIcono, hecho && styles.pasoIconoHecho, actual && styles.pasoIconoActual]}>
                      <Ionicons name={paso.icono} size={18} color={hecho ? colors.sobreAcento : colors.textMuted} />
                    </View>
                    <Text style={[styles.pasoTitulo, hecho && styles.pasoTituloHecho]}>{titulo}</Text>
                    {actual ? <Text style={styles.pasoActual}>Ahora</Text> : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.tarjeta}>
            <Text style={styles.subtitulo}>Tu pedido</Text>
            {pedido.items.map((item, i) => (
              <View key={i} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemNombre}>
                    {item.cantidad}× {item.nombre}
                  </Text>
                  {item.opciones.length > 0 ? (
                    <Text style={styles.itemOpciones}>{item.opciones.map((o) => o.nombre).join(', ')}</Text>
                  ) : null}
                </View>
                <Text style={styles.itemPrecio}>{formatPrice(item.precioUnitario * item.cantidad)}</Text>
              </View>
            ))}
            <View style={styles.separador} />
            <Linea etiqueta="Subtotal" valor={formatPrice(pedido.subtotal)} />
            <Linea etiqueta="Envío" valor={pedido.costoEnvio > 0 ? formatPrice(pedido.costoEnvio) : 'Gratis'} />
            {pedido.recargo > 0 ? <Linea etiqueta="Recargo link de pago" valor={formatPrice(pedido.recargo)} /> : null}
            <View style={styles.total}>
              <Text style={styles.totalEtiqueta}>Total</Text>
              <Text style={styles.totalValor}>{formatPrice(pedido.total)}</Text>
            </View>
          </View>

          {pedido.metodoPago === 'billetera_virtual_alias' && config?.aliasTransferencia && !cancelado ? (
            <View style={[styles.tarjeta, styles.tarjetaPago]}>
              <Text style={styles.subtitulo}>Datos para transferir</Text>
              <Linea etiqueta="Alias" valor={config.aliasTransferencia} />
              {config.cvu ? <Linea etiqueta="CVU" valor={config.cvu} /> : null}
              {config.titularCuenta ? <Linea etiqueta="Titular" valor={config.titularCuenta} /> : null}
              <Text style={styles.textoSecundario}>Mandanos el comprobante por WhatsApp.</Text>
            </View>
          ) : null}

          <Button
            label="Escribir por WhatsApp"
            variante="contorno"
            icono={<Ionicons name="logo-whatsapp" size={18} color={colors.acento} />}
            onPress={() => Linking.openURL(whatsappUrl(LOCAL.whatsapps[0].numero, mensajeWhatsapp))}
          />
          <Button label="Ver todos mis pedidos" variante="contorno" onPress={() => router.push('/mis-pedidos')} />
          <Button label="Volver al inicio" onPress={() => router.replace('/')} />
        </Contenedor>
      </ScrollView>
    </View>
  );
}

function Linea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.linea}>
      <Text style={styles.lineaEtiqueta}>{etiqueta}</Text>
      <Text style={styles.lineaValor} selectable>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { maxWidth: 720, gap: spacing.md, paddingTop: spacing.lg },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  cabecera: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  titulo: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  numero: { color: colors.acento, fontSize: 36, fontWeight: '700' },
  textoSecundario: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },

  tarjeta: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tarjetaPago: { borderColor: acentoAlpha(0.3) },
  subtitulo: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },

  paso: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  pasoIcono: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoIconoHecho: { backgroundColor: colors.acento },
  pasoIconoActual: { borderWidth: 3, borderColor: acentoAlpha(0.35) },
  pasoTitulo: { flex: 1, color: colors.textMuted, fontSize: 15 },
  pasoTituloHecho: { color: colors.textPrimary, fontWeight: '600' },
  pasoActual: { color: colors.acento, fontSize: 12, fontWeight: '700' },

  item: { flexDirection: 'row', gap: spacing.md },
  itemNombre: { color: colors.textPrimary, fontSize: 14 },
  itemOpciones: { color: colors.textMuted, fontSize: 12 },
  itemPrecio: { color: colors.textPrimary, fontSize: 14 },
  separador: { height: 1, backgroundColor: colors.border },
  linea: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  lineaEtiqueta: { color: colors.textSecondary, fontSize: 14 },
  lineaValor: { color: colors.textPrimary, fontSize: 14, flexShrink: 1, textAlign: 'right' },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalEtiqueta: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  totalValor: { color: colors.acento, fontSize: 22, fontWeight: '700' },
});
