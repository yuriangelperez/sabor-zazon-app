import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { EstadoPedido } from '@sabor/types';
import { mensajeError, verPedido, type SeguimientoPedido } from '@sabor/api-client';
import { acentoAlpha, Button, colors, radii, spacing, Text } from '@sabor/ui';
import { ETIQUETA_PAGO, faltaPagar, formatPrice, numeroPedido } from '@sabor/utils';

import { Contenedor } from '../../../components/Contenedor';
import { LOCAL, whatsappUrl } from '../../../constants/local';
import { useLocal } from '../../../hooks/useLocal';
import { usePagoMercadoPago } from '../../../hooks/usePagoMercadoPago';
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
  const params = useLocalSearchParams<{ id: string; c?: string; e?: string }>();
  const guardado = usePedidosStore((s) => s.pedidos.find((p) => p.id === params.id));
  const codigo = params.c ?? guardado?.codigo;
  const { config } = useLocal();
  const insets = useSafeAreaInsets();
  const [pedido, setPedido] = useState<SeguimientoPedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const pago = usePagoMercadoPago(params.id, codigo);
  const yaVerificado = useRef(false);

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

  // Al volver de Mercado Pago (o al abrir un pedido sin pagar) se pregunta
  // una vez si el pago ya se aprobó, por si el aviso de Mercado Pago demora.
  const pagoPendiente = pedido != null && faltaPagar(pedido.pagoEstado);
  const { verificar } = pago;
  useEffect(() => {
    if (!pagoPendiente || yaVerificado.current) return;
    yaVerificado.current = true;
    void verificar(true).then((estado) => {
      if (estado === 'aprobado') void cargar();
    });
  }, [pagoPendiente, verificar, cargar]);

  const verificarAhora = async () => {
    await verificar();
    await cargar();
  };

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
  const sinPagar = !cancelado && faltaPagar(pedido.pagoEstado);
  const rechazado = pedido.pagoEstado === 'rechazado';
  const indiceActual = PASOS.findIndex((p) => p.estado === pedido.estado);
  const mensajeWhatsapp = `¡Hola! Te escribo por mi pedido ${numeroPedido(pedido.numero)}.`;

  return (
    <View style={styles.pantalla}>
      <Stack.Screen options={{ title: `Pedido ${numeroPedido(pedido.numero)}` }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <Contenedor style={styles.contenido}>
          <View style={styles.cabecera}>
            <Ionicons
              name={cancelado ? 'close-circle' : sinPagar ? 'card' : 'checkmark-circle'}
              size={56}
              color={cancelado || rechazado ? colors.danger : sinPagar ? colors.acento : colors.success}
            />
            <Text style={styles.titulo}>
              {cancelado
                ? 'Pedido cancelado'
                : sinPagar
                  ? rechazado
                    ? 'El pago no se aprobó'
                    : 'Falta pagar tu pedido'
                  : '¡Recibimos tu pedido!'}
            </Text>
            <Text style={styles.numero}>{numeroPedido(pedido.numero)}</Text>
            <Text style={styles.textoSecundario}>
              {cancelado
                ? 'Si tenés dudas, escribinos por WhatsApp.'
                : sinPagar
                  ? rechazado
                    ? 'Probá de nuevo con otra tarjeta o medio de pago. El local recibe tu pedido cuando se aprueba el pago.'
                    : 'El local recibe tu pedido cuando se aprueba el pago en Mercado Pago.'
                  : 'Esta pantalla se actualiza sola a medida que avanza tu pedido.'}
            </Text>
          </View>

          {sinPagar ? (
            <View style={[styles.tarjeta, styles.tarjetaPago]}>
              <Button
                label={pago.abriendo ? 'Abriendo Mercado Pago…' : `Pagar ${formatPrice(pedido.total)} con Mercado Pago`}
                onPress={() => void pago.pagar()}
                disabled={pago.abriendo}
                icono={pago.abriendo ? <ActivityIndicator color={colors.sobreAcento} /> : <Ionicons name="card-outline" size={18} color={colors.sobreAcento} />}
              />
              <Button
                label={pago.verificando ? 'Consultando…' : 'Ya pagué, actualizar'}
                variante="contorno"
                onPress={() => void verificarAhora()}
                disabled={pago.verificando}
              />
              {pago.error || params.e ? <Text style={styles.error}>{pago.error ?? params.e}</Text> : null}
              <Text style={styles.textoSecundario}>Tarjeta de débito, crédito o dinero en cuenta de Mercado Pago.</Text>
            </View>
          ) : null}

          {!cancelado && !sinPagar ? (
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
            {pedido.recargo > 0 ? <Linea etiqueta="Recargo Mercado Pago" valor={formatPrice(pedido.recargo)} /> : null}
            <View style={styles.total}>
              <Text style={styles.totalEtiqueta}>Total</Text>
              <Text style={styles.totalValor}>{formatPrice(pedido.total)}</Text>
            </View>
            {pedido.pagoEstado === 'aprobado' ? (
              <View style={styles.pagado}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.pagadoTexto}>Pagado con {ETIQUETA_PAGO[pedido.metodoPago]}</Text>
              </View>
            ) : null}
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
  pagado: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pagadoTexto: { color: colors.success, fontSize: 14, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
});
