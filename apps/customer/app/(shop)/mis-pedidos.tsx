import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { EstadoPedido } from '@sabor/types';
import { Button, colors, radii, spacing, Text } from '@sabor/ui';
import { ETIQUETA_ESTADO, formatPrice, horaCorta, numeroPedido } from '@sabor/utils';

import { pedidoEnCurso, useMisPedidos, type MiPedido } from '../../hooks/useMisPedidos';

const COLOR_ESTADO: Record<EstadoPedido, string> = {
  por_aceptar: colors.acento,
  en_preparacion: colors.azul,
  listo: colors.success,
  entregado: colors.surfaceAlt,
  cancelado: colors.cerrado,
  rechazado: colors.cerrado,
};

function fecha(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const esHoy = d.toDateString() === hoy.toDateString();
  return esHoy ? `Hoy ${horaCorta(iso)}` : `${d.getDate()}/${d.getMonth() + 1} ${horaCorta(iso)}`;
}

// RF-07 / RF-08: los pedidos hechos desde este dispositivo, para volver a
// ver su estado en cualquier momento.
export default function MisPedidos() {
  const { pedidos, cargando, refrescar } = useMisPedidos();

  if (cargando) return <ActivityIndicator color={colors.acento} style={{ marginTop: spacing.xl }} />;

  if (pedidos.length === 0) {
    return (
      <View style={styles.vacio}>
        <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
        <Text style={styles.vacioTitulo}>Todavía no hiciste pedidos</Text>
        <Text style={styles.vacioTexto}>Cuando hagas uno, vas a poder seguirlo desde acá.</Text>
        <Button label="Ver menú" onPress={() => router.replace('/menu')} />
      </View>
    );
  }

  const enCurso = pedidos.filter(pedidoEnCurso);
  const anteriores = pedidos.filter((p) => p.seguimiento && !pedidoEnCurso(p));
  // Sin respuesta del servidor: no sabemos si siguen en curso.
  const sinEstado = pedidos.filter((p) => !p.seguimiento);

  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={styles.contenido}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refrescar} tintColor={colors.acento} />}
    >
      {enCurso.length > 0 ? (
        <>
          <Text style={styles.seccion}>En curso</Text>
          {enCurso.map((p) => (
            <FilaPedido key={p.id} pedido={p} />
          ))}
        </>
      ) : null}
      {sinEstado.length > 0 ? (
        <>
          <Text style={styles.seccion}>Sin estado</Text>
          <Text style={styles.nota}>No pudimos consultar su estado. Revisá tu conexión y deslizá hacia abajo para reintentar.</Text>
          {sinEstado.map((p) => (
            <FilaPedido key={p.id} pedido={p} />
          ))}
        </>
      ) : null}
      {anteriores.length > 0 ? (
        <>
          <Text style={styles.seccion}>Anteriores</Text>
          {anteriores.map((p) => (
            <FilaPedido key={p.id} pedido={p} />
          ))}
        </>
      ) : null}
      <Text style={styles.nota}>Se muestran los pedidos hechos desde este dispositivo.</Text>
    </ScrollView>
  );
}

function FilaPedido({ pedido }: { pedido: MiPedido }) {
  const estado = pedido.seguimiento?.estado;
  const cantidad = pedido.seguimiento?.items.reduce((acc, i) => acc + i.cantidad, 0) ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: pedido.id, c: pedido.codigo } })}
      style={[styles.fila, estado && pedidoEnCurso(pedido) && styles.filaActiva]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.filaTitulo}>
          <Text style={styles.numero}>{numeroPedido(pedido.numero)}</Text>
          {estado ? (
            <View style={[styles.estado, { backgroundColor: COLOR_ESTADO[estado] }]}>
              <Text style={[styles.estadoTexto, ['por_aceptar', 'listo'].includes(estado) && { color: colors.sobreAcento }]}>
                {ETIQUETA_ESTADO[estado]}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.detalle}>
          {fecha(pedido.creadoEn)}
          {pedido.seguimiento ? ` · ${cantidad} ${cantidad === 1 ? 'producto' : 'productos'} · ${formatPrice(pedido.seguimiento.total)}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.md, gap: spacing.sm, width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: spacing.xl },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  vacioTitulo: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  vacioTexto: { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
  seccion: { color: colors.acento, fontSize: 18, fontWeight: '600', marginTop: spacing.sm },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  filaActiva: { borderLeftWidth: 3, borderLeftColor: colors.acento },
  filaTitulo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  numero: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  estado: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  estadoTexto: { color: colors.textPrimary, fontSize: 11, fontWeight: '700' },
  detalle: { color: colors.textSecondary, fontSize: 13 },
  nota: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.md },
});
