import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { METODOS_MERCADO_PAGO, type CotizacionEnvio, type MetodoEntrega, type MetodoPago, type Punto } from '@sabor/types';
import { cotizarEnvio, crearPedido, mensajeError, ubicarAproximado } from '@sabor/api-client';
import { acentoAlpha, Button, colors, radii, spacing, Text, TextInput } from '@sabor/ui';
import { formatPrice } from '@sabor/utils';

import { Contenedor } from '../../components/Contenedor';
import { EstadoLocalBanner } from '../../components/EstadoLocalBanner';
import { MapaUbicacion } from '../../components/mapa/MapaUbicacion';
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
  const [direccion, setDireccion] = useState('');
  const [detalleDireccion, setDetalleDireccion] = useState('');
  const [cotizacion, setCotizacion] = useState<CotizacionEnvio | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  // Pin que marcó el cliente en el mapa (cuando la dirección escrita no se
  // encuentra o queda mal ubicada). Si después cambia el texto, se descarta y
  // se busca lo nuevo: un pin viejo (ej. "Estoy acá" desde una PC, que ubica
  // por IP) no puede ganarle a una dirección que sí se encuentra.
  const [pinElegido, setPinElegido] = useState<Punto | null>(null);
  // Mapa abierto: dónde arrancó, dónde está el pin ahora y a dónde moverlo
  // (cuando el cliente cambia la dirección con el mapa abierto).
  const [mapa, setMapa] = useState<{ centro: Punto; zoom: number; pin: Punto; irA: Punto | null; aviso: string | null } | null>(
    null
  );
  const direccionAlAbrirMapa = useRef('');
  // Última dirección (+ pin) pedida o ya cotizada: evita pedirla dos veces
  // cuando el blur del campo y el botón llegan juntos.
  const consultaEnCurso = useRef('');
  const [pago, setPago] = useState<MetodoPago | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [terminos, setTerminos] = useState(false);
  const [verTerminos, setVerTerminos] = useState(false);
  const [intentoEnviar, setIntentoEnviar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recepción puede apagar el delivery: solo se puede retirar en el local.
  const sinDelivery = config != null && !config.deliveryActivo;
  useEffect(() => {
    if (sinDelivery) setEntrega('retiro_local');
  }, [sinDelivery]);

  const cambiarDireccion = (valor: string) => {
    setDireccion(valor);
    consultaEnCurso.current = '';
    setPinElegido(null);
    setCotizacion(null);
    setErrorEnvio(null);
  };

  // Busca la dirección (o mide desde el pin, si marcó uno) y trae la
  // distancia y el costo.
  const calcularEnvio = async (pin: Punto | null = pinElegido) => {
    const buscada = direccion.trim();
    const consulta = `${buscada}|${pin ? `${pin.lat},${pin.lng}` : ''}`;
    if (!buscada || consultaEnCurso.current === consulta) return;
    consultaEnCurso.current = consulta;
    setCotizando(true);
    setErrorEnvio(null);
    try {
      const nueva = await cotizarEnvio(buscada, pin ?? undefined);
      // Si mientras tanto la cambió, esta respuesta ya no sirve.
      if (consultaEnCurso.current === consulta) setCotizacion(nueva);
    } catch (err) {
      if (consultaEnCurso.current === consulta) {
        consultaEnCurso.current = ''; // para poder reintentar
        setErrorEnvio(mensajeError(err, 'No pudimos calcular el envío.'));
      }
    } finally {
      setCotizando(false);
    }
  };

  // Abre el mapa donde quedó la dirección encontrada. Si no se encontró,
  // en lo más parecido al texto escrito y, si no hay nada, en el local.
  const centroMapa = pinElegido ?? cotizacion?.ubicacion ?? null;
  const puedeAbrirMapa = centroMapa != null || config?.localUbicacion != null;
  const [abriendoMapa, setAbriendoMapa] = useState(false);
  const abrirMapa = async () => {
    let centro = centroMapa;
    let zoom = 17;
    if (!centro && direccion.trim()) {
      setAbriendoMapa(true);
      centro = await ubicarAproximado(direccion.trim());
      setAbriendoMapa(false);
    }
    if (!centro) {
      centro = config?.localUbicacion ?? null;
      zoom = 15;
    }
    if (centro) {
      direccionAlAbrirMapa.current = direccion;
      setMapa({ centro, zoom, pin: centro, irA: null, aviso: null });
    }
  };

  // Con el mapa abierto, si cambia la dirección se busca sola apenas deja de
  // escribir, sin cerrar el mapa.
  const mapaAbierto = mapa != null;
  useEffect(() => {
    if (!mapaAbierto || !direccion.trim() || direccion === direccionAlAbrirMapa.current) return;
    const espera = setTimeout(() => void calcularEnvio(null), 900);
    return () => clearTimeout(espera);
  }, [direccion, mapaAbierto]);

  // Desde que empieza a escribir hasta que llega el resultado.
  const buscandoEnMapa =
    cotizando ||
    (mapaAbierto && !cotizacion && !errorEnvio && !!direccion.trim() && direccion !== direccionAlAbrirMapa.current);

  // Y cuando la encuentra, el mapa y el pin van a la dirección nueva.
  useEffect(() => {
    const ubicacion = cotizacion?.ubicacion;
    if (ubicacion && !pinElegido) setMapa((actual) => actual && { ...actual, pin: ubicacion, irA: ubicacion, aviso: null });
  }, [cotizacion]);

  const usarPin = () => {
    if (!mapa) return;
    if (!direccion.trim()) {
      setMapa({ ...mapa, aviso: 'Escribí también tu dirección arriba: es la que ve el repartidor.' });
      return;
    }
    // No movió el pin de la dirección encontrada: queda esa (con su nombre).
    if (cotizacion && cotizacion.ubicacion.lat === mapa.pin.lat && cotizacion.ubicacion.lng === mapa.pin.lng) {
      setMapa(null);
      return;
    }
    setPinElegido(mapa.pin);
    setMapa(null);
    setCotizacion(null);
    void calcularEnvio(mapa.pin);
  };

  const envio = entrega === 'delivery' ? (cotizacion?.costo ?? 0) : 0;
  const metodo = METODOS_PAGO.find((m) => m.id === pago);
  const conMercadoPago = pago != null && METODOS_MERCADO_PAGO.includes(pago);
  const recargo = metodo?.conRecargo ? Math.round((subtotal * (config?.recargoLinkPago ?? 0)) / 100) : 0;
  const total = subtotal + envio + recargo;

  const faltantes = useMemo(() => {
    const f: string[] = [];
    if (!nombre.trim()) f.push('tu nombre');
    if (celular.replace(/\D/g, '').length < 8) f.push('un celular válido');
    if (entrega === 'delivery' && !direccion.trim()) f.push('la dirección');
    else if (entrega === 'delivery' && !cotizacion) f.push('calcular el envío');
    if (!pago) f.push('el método de pago');
    if (!terminos) f.push('aceptar los términos');
    return f;
  }, [nombre, celular, entrega, direccion, cotizacion, pago, terminos]);

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
        cotizacionEnvioId: entrega === 'delivery' ? cotizacion?.id : undefined,
        detalleDireccion: entrega === 'delivery' ? detalleDireccion.trim() || undefined : undefined,
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
                detalle={sinDelivery ? 'No hay delivery por ahora' : config ? `Hasta ${kmTexto(config.envioKmMaximo)} km` : 'Según la distancia'}
                deshabilitada={sinDelivery}
              />
            </View>

            {entrega === 'retiro_local' ? (
              <View style={styles.aviso}>
                <Ionicons name="location-outline" size={18} color={colors.acento} />
                <Text style={styles.avisoTexto}>Retirás en {config?.direccionLocal ?? 'el local'}.</Text>
              </View>
            ) : (
              <>
                <Campo
                  etiqueta="Dirección (calle, altura y localidad)"
                  valor={direccion}
                  onChange={cambiarDireccion}
                  onBlur={() => void calcularEnvio()}
                  error={mostrarError(!direccion.trim())}
                  placeholder="Ej: Irigoyen 1234, Pilar"
                  autoComplete="street-address"
                />
                {mapa ? (
                  <View style={styles.campo}>
                    <Text style={styles.ayuda}>
                      Mové el pin hasta tu casa (o tocá el mapa donde está). Si tu calle no tiene nombre en el mapa, guiate
                      por las calles de alrededor. Desde el celular, "Estoy acá" usa tu GPS.
                    </Text>
                    <MapaUbicacion
                      centro={mapa.centro}
                      irA={mapa.irA}
                      local={config?.localUbicacion ?? null}
                      zoom={mapa.zoom}
                      onMensaje={(m) =>
                        setMapa((actual) =>
                          actual &&
                          ('error' in m
                            ? { ...actual, aviso: m.error }
                            : { ...actual, pin: { lat: m.lat, lng: m.lng }, aviso: m.aviso ?? null })
                        )
                      }
                    />
                    {buscandoEnMapa ? (
                      <View style={styles.aviso}>
                        <ActivityIndicator color={colors.acento} />
                        <Text style={styles.avisoTexto}>Buscando la dirección…</Text>
                      </View>
                    ) : errorEnvio ? (
                      <Text style={styles.textoError}>{errorEnvio}</Text>
                    ) : cotizacion ? (
                      <Text style={styles.ayuda}>
                        {cotizacion.direccion} · {kmTexto(cotizacion.distanciaKm)} km · envío {formatPrice(cotizacion.costo)}
                      </Text>
                    ) : null}
                    {mapa.aviso ? <Text style={styles.textoError}>{mapa.aviso}</Text> : null}
                    <View style={styles.opcionesFila}>
                      <Button label="Cancelar" variante="contorno" onPress={() => setMapa(null)} style={{ flex: 1 }} />
                      <Button label="Usar esta ubicación" onPress={usarPin} style={{ flex: 1 }} />
                    </View>
                  </View>
                ) : cotizacion ? (
                  <View style={styles.cotizacion}>
                    <Ionicons name="location" size={18} color={colors.acento} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.cotizacionDireccion}>{cotizacion.direccion}</Text>
                      <Text style={styles.ayuda}>
                        {kmTexto(cotizacion.distanciaKm)} km del local · envío {formatPrice(cotizacion.costo)}.
                      </Text>
                      <Text style={styles.enlace} onPress={() => void abrirMapa()} accessibilityRole="button">
                        {pinElegido ? 'Mover el pin en el mapa' : '¿No es ahí? Marcá tu casa en el mapa'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.campo}>
                    <Button
                      label={cotizando ? 'Calculando…' : 'Calcular envío'}
                      variante="contorno"
                      disabled={!direccion.trim() || cotizando}
                      onPress={() => void calcularEnvio()}
                      icono={cotizando ? <ActivityIndicator color={colors.acento} /> : undefined}
                    />
                    {errorEnvio ? (
                      <Text style={styles.textoError}>{errorEnvio}</Text>
                    ) : mostrarError(!!direccion.trim()) ? (
                      <Text style={styles.textoError}>Calculá el envío para continuar</Text>
                    ) : null}
                    {puedeAbrirMapa ? (
                      errorEnvio ? (
                        <Button
                          label={abriendoMapa ? 'Abriendo el mapa…' : 'Marcar mi casa en el mapa'}
                          variante="contorno"
                          disabled={abriendoMapa}
                          onPress={() => void abrirMapa()}
                        />
                      ) : (
                        <Text style={styles.enlace} onPress={() => void abrirMapa()} accessibilityRole="button">
                          {abriendoMapa ? 'Abriendo el mapa…' : '¿No te encuentra? Marcá tu casa en el mapa'}
                        </Text>
                      )
                    ) : null}
                  </View>
                )}
                <Campo
                  etiqueta="Piso, depto, lote o timbre (opcional)"
                  valor={detalleDireccion}
                  onChange={setDetalleDireccion}
                  placeholder="Ej: 3° B"
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
              valor={entrega === 'retiro_local' ? 'Gratis' : cotizacion ? formatPrice(envio) : 'Calculá el envío'}
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

const kmTexto = (km: number) => km.toLocaleString('es-AR', { maximumFractionDigits: 1 });

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
  onBlur,
  error,
  placeholder,
  teclado,
  autoComplete,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
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
        onBlur={onBlur}
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
  deshabilitada,
}: {
  seleccionada: boolean;
  onPress: () => void;
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  detalle: string;
  deshabilitada?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: seleccionada, disabled: deshabilitada }}
      disabled={deshabilitada}
      onPress={onPress}
      style={[styles.opcion, seleccionada && styles.opcionSeleccionada, deshabilitada && styles.opcionDeshabilitada]}
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
  opcionDeshabilitada: { opacity: 0.5 },
  opcionTitulo: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  opcionDetalle: { color: colors.textMuted, fontSize: 12 },

  aviso: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cotizacion: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: acentoAlpha(0.06),
    borderWidth: 1,
    borderColor: acentoAlpha(0.2),
  },
  cotizacionDireccion: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  enlace: { color: colors.acento, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
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
