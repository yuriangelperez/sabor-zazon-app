import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { EstadoPedido, Pedido } from '@sabor/types';
import { getPedidosDesde, mensajeError, suscribirPedidos } from '@sabor/api-client';
import { Chip, colors, radii, spacing, Text } from '@sabor/ui';
import { ETIQUETA_ESTADO, formatPrice } from '@sabor/utils';

import { TarjetaPedido } from '../../components/TarjetaPedido';

function inicioDelDia() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const ANULADOS: EstadoPedido[] = ['cancelado', 'rechazado'];

// Resumen de pedidos del día (todos los estados) con totales.
export default function Resumen() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoPedido | null>(null);

  const cargar = useCallback(async () => {
    try {
      setPedidos(await getPedidosDesde(inicioDelDia()));
      setError(null);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    return suscribirPedidos(() => void cargar());
  }, [cargar]);

  const stats = useMemo(() => {
    const validos = pedidos.filter((p) => !ANULADOS.includes(p.estado));
    const ventas = validos.reduce((acc, p) => acc + p.total, 0);
    return {
      cantidad: validos.length,
      ventas,
      ticket: validos.length ? Math.round(ventas / validos.length) : 0,
      entregados: pedidos.filter((p) => p.estado === 'entregado').length,
      anulados: pedidos.length - validos.length,
      delivery: validos.filter((p) => p.metodoEntrega === 'delivery').length,
      retiro: validos.filter((p) => p.metodoEntrega === 'retiro_local').length,
    };
  }, [pedidos]);

  const visibles = filtro ? pedidos.filter((p) => p.estado === filtro) : pedidos;

  if (cargando) return <ActivityIndicator color={colors.acento} style={{ marginTop: spacing.xl }} />;

  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={styles.contenido}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          tintColor={colors.acento}
          onRefresh={async () => {
            setRefrescando(true);
            await cargar();
            setRefrescando(false);
          }}
        />
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.metricas}>
        <Metrica titulo="Vendido hoy" valor={formatPrice(stats.ventas)} destacada />
        <Metrica titulo="Pedidos" valor={String(stats.cantidad)} />
        <Metrica titulo="Ticket promedio" valor={formatPrice(stats.ticket)} />
        <Metrica titulo="Entregados" valor={String(stats.entregados)} />
        <Metrica titulo="Delivery / Retiro" valor={`${stats.delivery} / ${stats.retiro}`} />
        <Metrica titulo="Cancelados" valor={String(stats.anulados)} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={`Todos (${pedidos.length})`} selected={filtro === null} onPress={() => setFiltro(null)} />
        {(Object.keys(ETIQUETA_ESTADO) as EstadoPedido[]).map((e) => {
          const n = pedidos.filter((p) => p.estado === e).length;
          return n > 0 ? (
            <Chip key={e} label={`${ETIQUETA_ESTADO[e]} (${n})`} selected={filtro === e} onPress={() => setFiltro(filtro === e ? null : e)} />
          ) : null;
        })}
      </ScrollView>

      {visibles.length === 0 ? (
        <Text style={styles.vacio}>Todavía no hay pedidos hoy.</Text>
      ) : (
        visibles.map((p) => (
          <View key={p.id} style={{ gap: 4 }}>
            <Text style={styles.estado}>{ETIQUETA_ESTADO[p.estado]}</Text>
            <TarjetaPedido pedido={p} />
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Metrica({ titulo, valor, destacada }: { titulo: string; valor: string; destacada?: boolean }) {
  return (
    <View style={[styles.metrica, destacada && styles.metricaDestacada]}>
      <Text style={styles.metricaTitulo}>{titulo}</Text>
      <Text style={[styles.metricaValor, destacada && { color: colors.acento }]}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl, width: '100%', maxWidth: 900, alignSelf: 'center' },
  error: { color: colors.danger, textAlign: 'center' },
  metricas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metrica: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  metricaDestacada: { borderColor: colors.acento },
  metricaTitulo: { color: colors.textSecondary, fontSize: 12 },
  metricaValor: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  chips: { gap: spacing.sm },
  vacio: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  estado: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});
