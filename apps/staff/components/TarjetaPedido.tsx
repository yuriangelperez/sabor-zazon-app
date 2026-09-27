import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EstadoPedido, ItemPedido, Pedido } from '@sabor/types';
import { acentoAlpha, Button, colors, radii, spacing, Text } from '@sabor/ui';
import { ETIQUETA_PAGO, formatPrice, horaCorta, numeroPedido, tiempoTranscurrido } from '@sabor/utils';

import { usePedidosEnVivoStore } from '../stores/usePedidosEnVivo';

// Minutos sin aceptar a partir de los cuales la tarjeta se marca en rojo.
const DEMORA_ALERTA_MIN = 5;

interface Accion {
  label: string;
  estado: EstadoPedido;
}

// RF-11: la acción principal de cada estado.
function accionPrincipal(pedido: Pedido): Accion | null {
  switch (pedido.estado) {
    case 'por_aceptar':
      return { label: 'Aceptar', estado: 'en_preparacion' };
    case 'en_preparacion':
      return { label: 'Pedido listo', estado: 'listo' };
    case 'listo':
      return {
        label: pedido.metodoEntrega === 'retiro_local' ? 'Pedido retirado' : 'Pedido entregado',
        estado: 'entregado',
      };
    default:
      return null;
  }
}

// RF-10: comanda. Resumida (nº, hora, cantidad de productos, total) y
// desglosada (productos, opciones, observaciones, cliente, pago).
export function TarjetaPedido({ pedido }: { pedido: Pedido }) {
  const cambiarEstado = usePedidosEnVivoStore((s) => s.cambiarEstado);
  const [abierta, setAbierta] = useState(pedido.estado === 'por_aceptar');
  const [confirmarRechazo, setConfirmarRechazo] = useState(false);

  const cantidadProductos = pedido.items.reduce((acc, i) => acc + i.cantidad, 0);
  const minutos = (Date.now() - new Date(pedido.creadoEn).getTime()) / 60_000;
  const demorado = pedido.estado === 'por_aceptar' && minutos >= DEMORA_ALERTA_MIN;
  const accion = accionPrincipal(pedido);
  const esDelivery = pedido.metodoEntrega === 'delivery';

  return (
    <View style={[styles.tarjeta, pedido.estado === 'por_aceptar' && styles.tarjetaNueva, demorado && styles.tarjetaDemorada]}>
      <Pressable onPress={() => setAbierta((a) => !a)} accessibilityRole="button" accessibilityLabel={`Pedido ${numeroPedido(pedido.numero)}`}>
        <View style={styles.fila}>
          <Text style={styles.numero}>{numeroPedido(pedido.numero)}</Text>
          <View style={[styles.badge, esDelivery ? styles.badgeDelivery : styles.badgeRetiro]}>
            <Ionicons name={esDelivery ? 'bicycle' : 'storefront'} size={12} color={colors.textPrimary} />
            <Text style={styles.badgeTexto}>{esDelivery ? 'Delivery' : 'Retiro'}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.total}>{formatPrice(pedido.total)}</Text>
        </View>
        <View style={styles.fila}>
          <Text style={[styles.meta, demorado && styles.metaDemorada]}>
            {horaCorta(pedido.creadoEn)} · {tiempoTranscurrido(pedido.creadoEn)}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.meta}>
            {cantidadProductos} {cantidadProductos === 1 ? 'producto' : 'productos'}
          </Text>
          <Ionicons name={abierta ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </View>
      </Pressable>

      {abierta ? (
        <View style={styles.detalle}>
          <View style={styles.cliente}>
            <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.clienteNombre}>{pedido.nombreCliente}</Text>
            <Pressable
              onPress={() => Linking.openURL(`https://wa.me/${pedido.celularCliente.replace(/\D/g, '')}`)}
              hitSlop={6}
            >
              <Text style={styles.enlace}>{pedido.celularCliente}</Text>
            </Pressable>
          </View>
          {esDelivery ? (
            <View style={styles.cliente}>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.direccion}>{pedido.direccionEntrega}</Text>
            </View>
          ) : null}

          <View style={styles.items}>
            {pedido.items.map((item) => (
              <LineaItem key={item.id} item={item} />
            ))}
          </View>

          {pedido.observaciones ? (
            <View style={styles.observaciones}>
              <Ionicons name="alert-circle" size={18} color={colors.acento} />
              <Text style={styles.observacionesTexto}>{pedido.observaciones}</Text>
            </View>
          ) : null}

          <View style={styles.totales}>
            <LineaTotal etiqueta="Subtotal" valor={formatPrice(pedido.subtotal)} />
            {pedido.costoEnvio > 0 ? <LineaTotal etiqueta="Envío" valor={formatPrice(pedido.costoEnvio)} /> : null}
            {pedido.recargo > 0 ? <LineaTotal etiqueta="Recargo link de pago" valor={formatPrice(pedido.recargo)} /> : null}
            <LineaTotal etiqueta="Pago" valor={ETIQUETA_PAGO[pedido.metodoPago]} />
          </View>

          {pedido.estado === 'por_aceptar' ? (
            confirmarRechazo ? (
              <View style={styles.confirmar}>
                <Text style={styles.confirmarTexto}>¿Rechazar el pedido? Avisale al cliente por WhatsApp.</Text>
                <View style={styles.acciones}>
                  <Button label="No" variante="contorno" onPress={() => setConfirmarRechazo(false)} style={styles.accion} />
                  <Button
                    label="Sí, rechazar"
                    variante="secundario"
                    onPress={() => void cambiarEstado(pedido.id, 'rechazado')}
                    style={[styles.accion, { backgroundColor: colors.danger }]}
                  />
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setConfirmarRechazo(true)} style={styles.rechazar} hitSlop={6}>
                <Text style={styles.rechazarTexto}>Rechazar pedido</Text>
              </Pressable>
            )
          ) : null}
        </View>
      ) : null}

      {accion && !confirmarRechazo ? (
        <Button label={accion.label} onPress={() => void cambiarEstado(pedido.id, accion.estado)} style={styles.botonPrincipal} />
      ) : null}
    </View>
  );
}

// "2× Combo Maracay — Arepa 1: Pelúa, Frita · Arepa 2: Pollo, Asada"
function LineaItem({ item }: { item: ItemPedido }) {
  const grupos = new Map<string, string[]>();
  for (const o of item.opciones) {
    grupos.set(o.grupoNombre, [...(grupos.get(o.grupoNombre) ?? []), o.cantidad > 1 ? `${o.cantidad}× ${o.nombre}` : o.nombre]);
  }

  return (
    <View style={styles.item}>
      <View style={styles.fila}>
        <Text style={styles.itemCantidad}>{item.cantidad}×</Text>
        <Text style={styles.itemNombre}>{item.nombre}</Text>
        <Text style={styles.itemPrecio}>{formatPrice(item.precioUnitario * item.cantidad)}</Text>
      </View>
      {[...grupos.entries()].map(([grupo, opciones]) => (
        <Text key={grupo} style={styles.itemOpcion}>
          <Text style={styles.itemOpcionGrupo}>{grupo}: </Text>
          {opciones.join(', ')}
        </Text>
      ))}
      {item.acompañamientos.length > 0 ? (
        <Text style={styles.itemOpcion}>
          <Text style={styles.itemOpcionGrupo}>Incluye: </Text>
          {item.acompañamientos.join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

function LineaTotal({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.totalEtiqueta}>{etiqueta}</Text>
      <View style={{ flex: 1 }} />
      <Text style={styles.totalValor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tarjetaNueva: { borderLeftWidth: 3, borderLeftColor: colors.acento },
  tarjetaDemorada: { borderColor: colors.danger, borderLeftColor: colors.danger },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  numero: { color: colors.acento, fontSize: 22, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeDelivery: { backgroundColor: colors.azul },
  badgeRetiro: { backgroundColor: colors.surfaceAlt },
  badgeTexto: { color: colors.textPrimary, fontSize: 11, fontWeight: '600' },
  total: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 13 },
  metaDemorada: { color: colors.danger, fontWeight: '700' },

  detalle: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  cliente: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  clienteNombre: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  enlace: { color: colors.whatsapp, fontSize: 14, fontWeight: '600' },
  direccion: { color: colors.textPrimary, fontSize: 14, flex: 1 },

  items: { gap: spacing.sm, marginTop: spacing.xs },
  item: { gap: 2 },
  itemCantidad: { color: colors.acento, fontSize: 15, fontWeight: '700', minWidth: 28 },
  itemNombre: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', flex: 1 },
  itemPrecio: { color: colors.textSecondary, fontSize: 14 },
  itemOpcion: { color: colors.textSecondary, fontSize: 13, marginLeft: 36 },
  itemOpcionGrupo: { color: colors.textPrimary, fontWeight: '600' },

  observaciones: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: acentoAlpha(0.1),
    borderWidth: 1,
    borderColor: acentoAlpha(0.35),
  },
  observacionesTexto: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '600' },

  totales: { gap: 2 },
  totalEtiqueta: { color: colors.textMuted, fontSize: 13 },
  totalValor: { color: colors.textSecondary, fontSize: 13 },

  rechazar: { alignSelf: 'flex-start' },
  rechazarTexto: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  confirmar: { gap: spacing.sm },
  confirmarTexto: { color: colors.textPrimary, fontSize: 13 },
  acciones: { flexDirection: 'row', gap: spacing.sm },
  accion: { flex: 1, paddingVertical: 10 },
  botonPrincipal: { paddingVertical: 12 },
});
