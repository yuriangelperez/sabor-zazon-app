import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EstadoPedido, Pedido } from '@sabor/types';
import { colors, radii, spacing, Text } from '@sabor/ui';

import { TarjetaPedido } from '../../components/TarjetaPedido';
import { usePedidosEnVivoStore } from '../../stores/usePedidosEnVivo';

const COLUMNAS: { estado: EstadoPedido; titulo: string; color: string; vacio: string }[] = [
  { estado: 'por_aceptar', titulo: 'Por aceptar', color: colors.acento, vacio: 'Sin pedidos nuevos' },
  { estado: 'en_preparacion', titulo: 'En preparación', color: colors.azul, vacio: 'Nada en la cocina' },
  { estado: 'listo', titulo: 'Listos para entregar', color: colors.success, vacio: 'Nada esperando' },
];

// RF-09: tablero de pedidos en curso, en tiempo real.
export default function Tablero() {
  const { pedidos, cargando, error, cargar } = usePedidosEnVivoStore();
  const { width } = useWindowDimensions();
  const [pestana, setPestana] = useState<EstadoPedido>('por_aceptar');
  const [refrescando, setRefrescando] = useState(false);
  const [, setTic] = useState(0);
  const ancho = width >= 900;

  // Actualiza "hace X min" y el aviso de demora.
  useEffect(() => {
    const intervalo = setInterval(() => setTic((t) => t + 1), 30_000);
    return () => clearInterval(intervalo);
  }, []);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  if (cargando) return <ActivityIndicator color={colors.acento} style={{ marginTop: spacing.xl }} />;

  const porEstado = (estado: EstadoPedido) => pedidos.filter((p) => p.estado === estado);

  return (
    <View style={styles.pantalla}>
      {error ? (
        <View style={styles.error}>
          <Ionicons name="warning-outline" size={18} color={colors.textPrimary} />
          <Text style={styles.errorTexto}>{error}</Text>
        </View>
      ) : null}

      {ancho ? (
        <View style={styles.columnas}>
          {COLUMNAS.map((c) => (
            <View key={c.estado} style={styles.columna}>
              <EncabezadoColumna titulo={c.titulo} color={c.color} cantidad={porEstado(c.estado).length} />
              <ListaPedidos pedidos={porEstado(c.estado)} vacio={c.vacio} refrescando={refrescando} onRefrescar={refrescar} />
            </View>
          ))}
        </View>
      ) : (
        <>
          <View style={styles.pestanas}>
            {COLUMNAS.map((c) => {
              const activa = pestana === c.estado;
              const cantidad = porEstado(c.estado).length;
              return (
                <Pressable
                  key={c.estado}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activa }}
                  onPress={() => setPestana(c.estado)}
                  style={[styles.pestana, activa && { borderBottomColor: c.color }]}
                >
                  <Text style={[styles.pestanaTexto, activa && styles.pestanaTextoActiva]} numberOfLines={1}>
                    {c.titulo.replace(' para entregar', '')}
                  </Text>
                  <View style={[styles.contador, { backgroundColor: cantidad > 0 ? c.color : colors.surfaceAlt }]}>
                    <Text style={[styles.contadorTexto, cantidad > 0 && { color: colors.sobreAcento }]}>{cantidad}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <ListaPedidos
            pedidos={porEstado(pestana)}
            vacio={COLUMNAS.find((c) => c.estado === pestana)!.vacio}
            refrescando={refrescando}
            onRefrescar={refrescar}
          />
        </>
      )}
    </View>
  );
}

function EncabezadoColumna({ titulo, color, cantidad }: { titulo: string; color: string; cantidad: number }) {
  return (
    <View style={[styles.encabezadoColumna, { borderTopColor: color }]}>
      <Text style={styles.columnaTitulo}>{titulo}</Text>
      <View style={[styles.contador, { backgroundColor: cantidad > 0 ? color : colors.surfaceAlt }]}>
        <Text style={[styles.contadorTexto, cantidad > 0 && { color: colors.sobreAcento }]}>{cantidad}</Text>
      </View>
    </View>
  );
}

function ListaPedidos({
  pedidos,
  vacio,
  refrescando,
  onRefrescar,
}: {
  pedidos: Pedido[];
  vacio: string;
  refrescando: boolean;
  onRefrescar: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.lista}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefrescar} tintColor={colors.acento} />}
    >
      {pedidos.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons name="checkmark-done-outline" size={32} color={colors.textMuted} />
          <Text style={styles.vacioTexto}>{vacio}</Text>
        </View>
      ) : (
        pedidos.map((p) => <TarjetaPedido key={p.id} pedido={p} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  error: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.cerrado, padding: spacing.sm },
  errorTexto: { color: colors.textPrimary, flex: 1, fontSize: 13 },

  columnas: { flex: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  columna: { flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: radii.md, overflow: 'hidden' },
  encabezadoColumna: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderTopWidth: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  columnaTitulo: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },

  pestanas: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  pestana: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  pestanaTexto: { color: colors.textMuted, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  pestanaTextoActiva: { color: colors.textPrimary },
  contador: { minWidth: 24, height: 22, borderRadius: radii.pill, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  contadorTexto: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },

  lista: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  vacio: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  vacioTexto: { color: colors.textMuted, fontSize: 14 },
});
