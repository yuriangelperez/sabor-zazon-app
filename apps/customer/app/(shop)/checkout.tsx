import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { METODOS_MERCADO_PAGO, type MetodoEntrega, type MetodoPago, type ZonaEnvio } from '@sabor/types';
import { crearPedido, getZonasEnvio, mensajeError } from '@sabor/api-client';
import { acentoAlpha, Button, colors, radii, Selector, spacing, Text, TextInput } from '@sabor/ui';
import { formatPrice } from '@sabor/utils';

import { Contenedor } from '../../components/Contenedor';
import { EstadoLocalBanner } from '../../components/EstadoLocalBanner';
import { TerminosModal } from '../../components/TerminosModal';
import { useLocal } from '../../hooks/useLocal';
import { abrirPagoMercadoPago } from '../../hooks/usePagoMercadoPago';
import { selectSubtotal, useCarritoStore } from '../../stores/useCarritoStore';
import { usePedidosStore } from '../../stores/usePedidosStore';

const METODOS_PAGO: { id: MetodoPago; titulo: string; detalle: string; conRecargo: boolean; icono: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'billetera_virtual_alias', titulo: 'Transferencia', detalle: 'Alias o CVU', conRecargo: false, icono: 'swap-horizontal-outline' },
  { id: 'efectivo', titulo: 'Efectivo', detalle: 'Al recibir o retirar', conRecargo: false, icono: 'cash-outline' },
  { id: 'billetera_virtual_checkout', titulo: 'Mercado Pago', detalle: 'Dinero en cuenta', conRecargo: true, icono: 'wallet-outline' },
  { id: 'tarjeta', titulo: 'Tarjeta', detalle: 'Débito o crédito', conRecargo: true, icono: 'card-outline' },
];

// RF-06: checkout. Los totales de esta pantalla son una vista previa: el
// total definitivo lo calcula la base de datos al crear el pedido.
export default function Checkout() {
  const insets = useSafeAreaInsets();
  const items = useCarritoStore((s) => s.items);
  const subtotal = useCarritoStore(selectSubtotal);
  const vaciar = useCarritoStore((s) => s.vaciar);
  const datosGuardados = usePedidosStore();
  const { config, abierto } = useLocal();

  const [nombre, setNombre] = useState(datosGuardados.nombre);
  const [celular, setCelular] = useState(datosGuardados.celular);
  const [entrega, setEntrega] = useState<MetodoEntrega>('retiro_local');
  const [zonas, setZonas] = useState<ZonaEnvio[]>([]);
  const [zonaId, setZonaId] = useState<string | null>(null);
  const [direccion, setDireccion] = useState('');
  const [pago, setPago] = useState<MetodoPago | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [terminos, setTerminos] = useState(false);
  const [verTerminos, setVerTerminos] = useState(false);
  const [intentoEnviar, setIntentoEnviar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getZonasEnvio()
      .then(setZonas)
      .catch(() => setZonas([]));
  }, []);

  const zona = zonas.find((z) => z.id === zonaId);
  const envio = entrega === 'delivery' ? (zona?.costo ?? 0) : 0;
  const metodo = METODOS_PAGO.find((m) => m.id === pago);
  const conMercadoPago = pago != null && METODOS_MERCADO_PAGO.includes(pago);
  const recargo = metodo?.conRecargo ? Math.round((subtotal * (config?.recargoLinkPago ?? 0)) / 100) : 0;
  const total = subtotal + envio + recargo;

  const faltantes = useMemo(() => {
    const f: string[] = [];
    if (!nombre.trim()) f.push('tu nombre');
    if (celular.replace(/\D/g, '').length < 8) f.push('un celular válido');
    if (entrega === 'delivery' && !zonaId) f.push('la zona de envío');
    if (entrega === 'delivery' && !direccion.trim()) f.push('la dirección');
    if (!pago) f.push('el método de pago');
    if (!terminos) f.push('aceptar los términos');
    return f;
  }, [nombre, celular, entrega, zonaId, direccion, pago, terminos]);

  if (items.length === 0) {
    return (
      <View style={styles.vacio}>
        <Text style={styles.vacioTexto}>Tu carrito está vacío.</Text>
        <Button label="Ver menú" onPress={() => router.replace('/menu')} />
      </View>
    );
  }

  const confirmar = async () => {
    setIntentoEnviar(true);
    setError(null);
    if (faltantes.length > 0 || !pago) return;

    setEnviando(true);
    try {
      const creado = await crearPedido({
        nombreCliente: nombre.trim(),
        celularCliente: celular.trim(),
        metodoEntrega: entrega,
        zonaEnvioId: entrega === 'delivery' ? (zonaId ?? undefined) : undefined,
        direccionEntrega: entrega === 'delivery' ? direccion.trim() : undefined,
        metodoPago: pago,
        observaciones: observaciones.trim() || undefined,
        terminosAceptados: terminos,
        items: items.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
          opciones: i.opcionesElegidas.map((o) => ({ grupoId: o.grupoId, opcionId: o.opcionId, cantidad: o.cantidad })),
        })),
      });
      datosGuardados.guardarDatos(nombre.trim(), celular.trim());
      datosGuardados.guardarPedido({
        id: creado.id,
        numero: creado.numero,
        codigo: creado.codigoSeguimiento,
        creadoEn: new Date().toISOString(),
      });
      vaciar();
      if (!conMercadoPago) {
        router.replace({ pathname: '/pedido/[id]', params: { id: creado.id, c: creado.codigoSeguimiento } });
        return;
      }
      try {
        await abrirPagoMercadoPago(creado.id, creado.codigoSeguimiento);
      } catch (err) {
        // El pedido ya quedó guardado: el seguimiento muestra el error y el
        // botón "Pagar" para reintentar.
        router.replace({
          pathname: '/pedido/[id]',
          params: { id: creado.id, c: creado.codigoSeguimiento, e: mensajeError(err, 'No pudimos abrir Mercado Pago.') },
        });
      }
    } catch (err) {
      setError(mensajeError(err, 'No pudimos enviar tu pedido. Probá de nuevo.'));
    } finally {
      setEnviando(false);
    }
  };

  const mostrarError = (condicion: boolean) => intentoEnviar && condicion;

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <EstadoLocalBanner />
      <ScrollView contentContainerStyle={{ paddingBottom: 160 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <Contenedor style={styles.contenido}>
          <Seccion titulo="Tus datos" icono="person-outline">
            <Campo
              etiqueta="Nombre y apellido"
              valor={nombre}
              onChange={setNombre}
              error={mostrarError(!nombre.trim())}
              autoComplete="name"
            />
            <Campo
              etiqueta="Celular (WhatsApp)"
              valor={celular}
              onChange={setCelular}
              error={mostrarError(celular.replace(/\D/g, '').length < 8)}
              teclado="phone-pad"
              autoComplete="tel"
              placeholder="11 2345 6789"
            />
          </Seccion>

          <Seccion titulo="Entrega" icono="bicycle-outline">
            <View style={styles.opcionesFila}>
              <Opcion
                seleccionada={entrega === 'retiro_local'}
                onPress={() => setEntrega('retiro_local')}
                icono="storefront-outline"
                titulo="Retiro en el local"
                detalle="Gratis"
              />
              <Opcion
                seleccionada={entrega === 'delivery'}
                onPress={() => setEntrega('delivery')}
                icono="bicycle-outline"
                titulo="Delivery"
                detalle="Según la zona"
              />
            </View>

            {entrega === 'retiro_local' ? (
              <View style={styles.aviso}>
                <Ionicons name="location-outline" size={18} color={colors.acento} />
                <Text style={styles.avisoTexto}>Retirás en {config?.direccionLocal ?? 'el local'}.</Text>
              </View>
            ) : (
              <>
                <View style={styles.campo}>
                  <Text style={styles.etiqueta}>Zona de envío</Text>
                  <Selector
                    titulo="Zona de envío"
                    valor={zonaId}
                    placeholder={zonas.length ? 'Elegí tu zona' : 'Cargando zonas…'}
                    opciones={zonas.map((z) => ({ id: z.id, label: z.nombre, detalle: `+${formatPrice(z.costo)}` }))}
                    onChange={setZonaId}
                  />
                  {mostrarError(!zonaId) ? <Text style={styles.textoError}>Elegí tu zona</Text> : null}
                  <Text style={styles.ayuda}>¿Tu zona no está? Escribinos por WhatsApp antes de pedir.</Text>
                </View>
                <Campo
                  etiqueta="Dirección (calle, altura, piso)"
                  valor={direccion}
                  onChange={setDireccion}
                  error={mostrarError(!direccion.trim())}
                  placeholder="Ej: Irigoyen 1234"
                  autoComplete="street-address"
                />
              </>
            )}
          </Seccion>

          <Seccion titulo="Pago" icono="card-outline">
            <View style={styles.opcionesGrilla}>
              {METODOS_PAGO.map((m) => (
                <Opcion
                  key={m.id}
                  seleccionada={pago === m.id}
                  onPress={() => setPago(m.id)}
                  icono={m.icono}
                  titulo={m.titulo}
                  detalle={m.conRecargo && config ? `${m.detalle} · +${config.recargoLinkPago}%` : m.detalle}
                />
              ))}
            </View>
            {mostrarError(!pago) ? <Text style={styles.textoError}>Elegí cómo vas a pagar</Text> : null}
            {pago === 'billetera_virtual_alias' && config?.aliasTransferencia ? (
              <View style={styles.datosTransferencia}>
                <Dato etiqueta="Alias" valor={config.aliasTransferencia} />
                {config.cvu ? <Dato etiqueta="CVU" valor={config.cvu} /> : null}
                {config.titularCuenta ? <Dato etiqueta="Titular" valor={config.titularCuenta} /> : null}
                <Text style={styles.ayuda}>Transferí el total y mandanos el comprobante por WhatsApp.</Text>
              </View>
            ) : null}
            {conMercadoPago ? (
              <View style={styles.aviso}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.acento} />
                <Text style={styles.avisoTexto}>
                  Al confirmar te llevamos a Mercado Pago para pagar de forma segura. El local recibe tu pedido cuando se
                  aprueba el pago.
                </Text>
              </View>
            ) : null}
          </Seccion>

          <Seccion titulo="Observaciones" icono="chatbox-ellipses-outline">
            <TextInput
              value={observaciones}
              onChangeText={setObservaciones}
              placeholder="Ej: soy alérgica a los camarones, sin salsa, timbre 2B…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={300}
              style={[styles.input, styles.inputMultilinea]}
            />
          </Seccion>

          <Seccion titulo="Resumen" icono="receipt-outline">
            {items.map((i) => (
              <View key={i.key} style={styles.lineaItem}>
                <Text style={styles.itemTexto} numberOfLines={1}>
                  {i.cantidad}× {i.nombre}
                </Text>
                <Text style={styles.itemPrecio}>{formatPrice(i.precioUnitario * i.cantidad)}</Text>
              </View>
            ))}
            <View style={styles.separador} />
            <Linea etiqueta="Subtotal" valor={formatPrice(subtotal)} />
            <Linea
              etiqueta="Envío"
              valor={entrega === 'retiro_local' ? 'Gratis' : zona ? formatPrice(envio) : 'Elegí tu zona'}
            />
            {recargo > 0 ? <Linea etiqueta={`Recargo Mercado Pago (${config?.recargoLinkPago}%)`} valor={formatPrice(recargo)} /> : null}
            <View style={styles.lineaTotal}>
              <Text style={styles.totalEtiqueta}>Total</Text>
              <Text style={styles.totalValor}>{formatPrice(total)}</Text>
            </View>
          </Seccion>

          <View style={styles.terminos}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: terminos }}
              accessibilityLabel="Acepto los términos y condiciones"
              onPress={() => setTerminos((t) => !t)}
              hitSlop={8}
              style={[styles.check, terminos && styles.checkActivo, mostrarError(!terminos) && styles.checkError]}
            >
              {terminos ? <Ionicons name="checkmark" size={16} color={colors.sobreAcento} /> : null}
            </Pressable>
            <Text style={styles.terminosTexto}>
              <Text style={styles.terminosTexto} onPress={() => setTerminos((t) => !t)}>
                Acepto los{' '}
              </Text>
              <Text style={styles.terminosEnlace} onPress={() => setVerTerminos(true)} accessibilityRole="link">
                términos y condiciones
              </Text>
            </Text>
          </View>
        </Contenedor>
      </ScrollView>

      <TerminosModal
        visible={verTerminos}
        onCerrar={() => setVerTerminos(false)}
        onAceptar={() => {
          setTerminos(true);
          setVerTerminos(false);
        }}
      />

      <View style={[styles.barra, { paddingBottom: insets.bottom + spacing.md }]}>
        <Contenedor style={styles.barraContenido}>
          {error ? <Text style={styles.errorEnvio}>{error}</Text> : null}
          {intentoEnviar && faltantes.length > 0 ? (
            <Text style={styles.faltantes}>Falta: {faltantes.join(', ')}.</Text>
          ) : null}
          <Button
            label={
              enviando
                ? conMercadoPago
                  ? 'Abriendo Mercado Pago…'
                  : 'Enviando…'
                : !abierto
                  ? 'El local está cerrado'
                  : conMercadoPago
                    ? `Pagar ${formatPrice(total)} con Mercado Pago`
                    : `Confirmar pedido · ${formatPrice(total)}`
            }
            onPress={confirmar}
            disabled={enviando || !abierto}
            icono={enviando ? <ActivityIndicator color={colors.sobreAcento} /> : undefined}
          />
        </Contenedor>
      </View>
    </KeyboardAvoidingView>
  );
}

function Seccion({ titulo, icono, children }: { titulo: string; icono: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  return (
    <View style={styles.seccion}>
      <View style={styles.seccionEncabezado}>
        <Ionicons name={icono} size={20} color={colors.acento} />
        <Text style={styles.seccionTitulo}>{titulo}</Text>
      </View>
      {children}
    </View>
  );
}

function Campo({
  etiqueta,
  valor,
  onChange,
  error,
  placeholder,
  teclado,
  autoComplete,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  error?: boolean;
  placeholder?: string;
  teclado?: 'phone-pad';
  autoComplete?: 'name' | 'tel' | 'street-address';
}) {
  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={teclado}
        autoComplete={autoComplete}
        style={[styles.input, error && styles.inputError]}
      />
      {error ? <Text style={styles.textoError}>Completá este dato</Text> : null}
    </View>
  );
}

function Opcion({
  seleccionada,
  onPress,
  icono,
  titulo,
  detalle,
}: {
  seleccionada: boolean;
  onPress: () => void;
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  detalle: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: seleccionada }}
      onPress={onPress}
      style={[styles.opcion, seleccionada && styles.opcionSeleccionada]}
    >
      <Ionicons name={icono} size={22} color={seleccionada ? colors.acento : colors.textSecondary} />
      <Text style={styles.opcionTitulo}>{titulo}</Text>
      <Text style={styles.opcionDetalle}>{detalle}</Text>
    </Pressable>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text style={styles.datoValor} selectable>
        {valor}
      </Text>
    </View>
  );
}

function Linea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.lineaItem}>
      <Text style={styles.lineaEtiqueta}>{etiqueta}</Text>
      <Text style={styles.lineaValor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { maxWidth: 720, gap: spacing.md, paddingTop: spacing.md },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  vacioTexto: { color: colors.textSecondary, fontSize: 16 },

  seccion: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  seccionEncabezado: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  seccionTitulo: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },

  campo: { gap: 6 },
  etiqueta: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: 15,
  },
  inputMultilinea: { minHeight: 90, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  textoError: { color: colors.danger, fontSize: 12 },
  ayuda: { color: colors.textMuted, fontSize: 12 },

  opcionesFila: { flexDirection: 'row', gap: spacing.sm },
  opcionesGrilla: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  opcion: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: 4,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  opcionSeleccionada: { borderColor: colors.acento, backgroundColor: acentoAlpha(0.08) },
  opcionTitulo: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  opcionDetalle: { color: colors.textMuted, fontSize: 12 },

  aviso: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avisoTexto: { color: colors.textSecondary, fontSize: 14, flex: 1 },

  datosTransferencia: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: acentoAlpha(0.06),
    borderWidth: 1,
    borderColor: acentoAlpha(0.2),
  },
  dato: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  datoEtiqueta: { color: colors.textSecondary, fontSize: 13 },
  datoValor: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  lineaItem: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  itemTexto: { color: colors.textSecondary, fontSize: 14, flex: 1 },
  itemPrecio: { color: colors.textPrimary, fontSize: 14 },
  separador: { height: 1, backgroundColor: colors.border },
  lineaEtiqueta: { color: colors.textSecondary, fontSize: 14 },
  lineaValor: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  lineaTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.xs },
  totalEtiqueta: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  totalValor: { color: colors.acento, fontSize: 22, fontWeight: '700' },

  terminos: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingHorizontal: spacing.xs },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActivo: { backgroundColor: colors.acento, borderColor: colors.acento },
  checkError: { borderColor: colors.danger },
  terminosTexto: { flex: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  terminosEnlace: { color: colors.acento, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },

  barra: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  barraContenido: { maxWidth: 720, gap: spacing.sm },
  faltantes: { color: colors.warning, fontSize: 13, textAlign: 'center' },
  errorEnvio: { color: colors.danger, fontSize: 14, textAlign: 'center', fontWeight: '600' },
});
