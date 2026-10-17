import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EstadoPedido, Pedido } from '@sabor/types';
import { getPedidosEntre, LIMITE_PEDIDOS_RANGO, mensajeError, suscribirPedidos } from '@sabor/api-client';
import { acentoAlpha, Chip, colors, radii, spacing, Text } from '@sabor/ui';
import { ETIQUETA_ESTADO, formatPrice } from '@sabor/utils';

import { TarjetaPedido } from '../../components/TarjetaPedido';
import { SelectorFecha, type ModoSelectorFecha, type RangoFechas } from '../../components/SelectorFecha';

type FiltroModo = 'dia' | 'semana' | 'mes' | 'rango';

const ANULADOS: EstadoPedido[] = ['cancelado', 'rechazado'];

// Abreviaturas de día y mes para las etiquetas de período.
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// El día a 00:00 (sin tocar la fecha original).
function inicioDelDia(d: Date): Date {
  const copia = new Date(d);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

// El día siguiente a 00:00 (límite superior exclusivo del día).
function finDelDia(d: Date): Date {
  const copia = inicioDelDia(d);
  copia.setDate(copia.getDate() + 1);
  return copia;
}

function rangoDia(ref: Date): RangoFechas {
  return { desde: inicioDelDia(ref), hasta: finDelDia(ref) };
}

// Lunes a domingo (límite superior exclusivo). Base en (getDay()+6)%7 para
// que el lunes quede en el índice 0.
function rangoSemana(ref: Date): RangoFechas {
  const base = inicioDelDia(ref);
  const offset = (base.getDay() + 6) % 7;
  const desde = new Date(base);
  desde.setDate(base.getDate() - offset);
  const hasta = new Date(desde);
  hasta.setDate(desde.getDate() + 7);
  return { desde, hasta };
}

// Primer día del mes a 00:00 .. primer día del mes siguiente a 00:00.
function rangoMes(anio: number, mes: number): RangoFechas {
  return { desde: new Date(anio, mes, 1), hasta: new Date(anio, mes + 1, 1) };
}

const MODOS: { id: FiltroModo; label: string }[] = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'rango', label: 'Rango' },
];

// Resumen de pedidos con filtros (día/semana/mes/rango) y métricas dinámicas.
// Muestra TODOS los pedidos del período elegido (no solo los de hoy).
export default function Resumen() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoPedido | null>(null);

  // Modo de filtro y fechas asociadas. Por defecto "día = hoy".
  const [filtroModo, setFiltroModo] = useState<FiltroModo>('dia');
  const [fechaDia, setFechaDia] = useState<Date>(() => new Date());
  const [semanaRef, setSemanaRef] = useState<Date>(() => new Date());
  const [mesValor, setMesValor] = useState<{ anio: number; mes: number }>(() => {
    const ahora = new Date();
    return { anio: ahora.getFullYear(), mes: ahora.getMonth() };
  });
  const [rango, setRango] = useState<RangoFechas>(() => {
    const hoy = inicioDelDia(new Date());
    return { desde: hoy, hasta: finDelDia(hoy) };
  });
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  // Rango activo según el modo y las fechas elegidas.
  const rangoActivo = useMemo<RangoFechas>(() => {
    switch (filtroModo) {
      case 'dia':
        return rangoDia(fechaDia);
      case 'semana':
        return rangoSemana(semanaRef);
      case 'mes':
        return rangoMes(mesValor.anio, mesValor.mes);
      case 'rango':
        return rango;
    }
  }, [filtroModo, fechaDia, semanaRef, mesValor, rango]);

  // Contador de generación: al cambiar de filtro rápido pueden quedar varios
  // fetchs en vuelo; descarta las resoluciones stale para que un rango viejo
  // no pise los datos del rango nuevo bajo la etiqueta nueva.
  const generacionRef = useRef(0);

  const cargar = useCallback(async () => {
    const gen = ++generacionRef.current;
    try {
      const resultado = await getPedidosEntre(rangoActivo.desde, rangoActivo.hasta);
      if (gen !== generacionRef.current) return; // resolución stale: se descarta
      setPedidos(resultado);
      setError(null);
    } catch (err) {
      if (gen !== generacionRef.current) return;
      setError(mensajeError(err));
    } finally {
      if (gen === generacionRef.current) setCargando(false);
    }
  }, [rangoActivo]);

  // Recarga al cambiar el rango y escucha pedidos en tiempo real.
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

  // Etiqueta del período activo para el botón que abre el calendario.
  const etiquetaPeriodo = useMemo(() => {
    switch (filtroModo) {
      case 'dia': {
        const d = fechaDia;
        const esHoy = inicioDelDia(d).getTime() === inicioDelDia(new Date()).getTime();
        return esHoy
          ? `Hoy · ${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
          : `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
      }
      case 'semana': {
        const fin = new Date(rangoActivo.hasta);
        fin.setDate(fin.getDate() - 1);
        return `Semana del ${rangoActivo.desde.getDate()} ${MESES_CORTOS[rangoActivo.desde.getMonth()]} al ${fin.getDate()} ${MESES_CORTOS[fin.getMonth()]}`;
      }
      case 'mes':
        return `${MESES_LARGOS[mesValor.mes]} ${mesValor.anio}`;
      case 'rango': {
        const fin = new Date(rango.hasta);
        fin.setDate(fin.getDate() - 1);
        const mismoMes =
          rango.desde.getMonth() === fin.getMonth() && rango.desde.getFullYear() === fin.getFullYear();
        return mismoMes
          ? `${rango.desde.getDate()} – ${fin.getDate()} ${MESES_CORTOS[fin.getMonth()]}`
          : `${rango.desde.getDate()} ${MESES_CORTOS[rango.desde.getMonth()]} – ${fin.getDate()} ${MESES_CORTOS[fin.getMonth()]}`;
      }
    }
  }, [filtroModo, fechaDia, rangoActivo, mesValor, rango]);

  const etiquetaVenta = useMemo(() => {
    switch (filtroModo) {
      case 'dia':
        return 'Vendido en el día';
      case 'semana':
        return 'Vendido en la semana';
      case 'mes':
        return 'Vendido en el mes';
      case 'rango':
        return 'Vendido en el rango';
    }
  }, [filtroModo]);

  // El selector abre en el modo del filtro. Semana usa 'simple' (se elige un
  // día y se toma toda su semana).
  const modoSelector: ModoSelectorFecha = filtroModo === 'mes' ? 'mes' : filtroModo === 'rango' ? 'rango' : 'simple';

  // Valor inicial del selector según el filtro activo.
  const valorInicialSelector = useMemo<RangoFechas | null>(() => {
    switch (filtroModo) {
      case 'dia':
        return rangoDia(fechaDia);
      case 'semana':
        return rangoDia(semanaRef); // abre en el día de referencia, no en el lunes
      case 'mes':
        return rangoMes(mesValor.anio, mesValor.mes);
      case 'rango':
        return rango;
    }
  }, [filtroModo, fechaDia, semanaRef, mesValor, rango]);

  const confirmarFecha = (nuevoRango: RangoFechas) => {
    switch (filtroModo) {
      case 'dia':
        setFechaDia(nuevoRango.desde);
        break;
      case 'semana':
        setSemanaRef(nuevoRango.desde);
        break;
      case 'mes':
        setMesValor({ anio: nuevoRango.desde.getFullYear(), mes: nuevoRango.desde.getMonth() });
        break;
      case 'rango':
        setRango(nuevoRango);
        break;
    }
    setSelectorAbierto(false);
  };

  const visibles = filtro ? pedidos.filter((p) => p.estado === filtro) : pedidos;
  // Si la respuesta llegó al tope de filas, el período puede estar truncado y
  // las métricas podrían subcontar; se avisa al staff para que acorte el rango.
  const truncado = pedidos.length >= LIMITE_PEDIDOS_RANGO;

  if (cargando) return <ActivityIndicator color={colors.acento} style={{ marginTop: spacing.xl }} />;

  return (
    <>
      <FlatList
        style={styles.pantalla}
        contentContainerStyle={styles.contenido}
        data={visibles}
        keyExtractor={(p) => p.id}
        renderItem={({ item: p }) => (
          <View style={styles.item}>
            <Text style={styles.estado}>{ETIQUETA_ESTADO[p.estado]}</Text>
            <TarjetaPedido pedido={p} />
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.cabezal}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {truncado ? (
              <View style={styles.aviso}>
                <Ionicons name="alert-circle" size={16} color={colors.warning} />
                <Text style={styles.avisoTexto}>
                  Período truncado: llegamos al tope de pedidos ({LIMITE_PEDIDOS_RANGO}). Las métricas pueden
                  estar incompletas; acortá el rango para ver todo.
                </Text>
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modos}>
              {MODOS.map((m) => (
                <Chip key={m.id} label={m.label} selected={filtroModo === m.id} onPress={() => setFiltroModo(m.id)} />
              ))}
            </ScrollView>

            <Pressable
              onPress={() => setSelectorAbierto(true)}
              accessibilityRole="button"
              accessibilityLabel={`Período: ${etiquetaPeriodo}`}
              style={styles.periodo}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.acento} />
              <Text style={styles.periodoTexto} numberOfLines={1}>
                {etiquetaPeriodo}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
            </Pressable>

            <View style={styles.metricas}>
              <Metrica titulo={etiquetaVenta} valor={formatPrice(stats.ventas)} destacada />
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
                  <Chip
                    key={e}
                    label={`${ETIQUETA_ESTADO[e]} (${n})`}
                    selected={filtro === e}
                    onPress={() => setFiltro(filtro === e ? null : e)}
                  />
                ) : null;
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={<Text style={styles.vacio}>No hay pedidos en este período.</Text>}
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
      />

      <SelectorFecha
        titulo="Elegí el período"
        modo={modoSelector}
        visible={selectorAbierto}
        onClose={() => setSelectorAbierto(false)}
        onConfirm={confirmarFecha}
        valorInicial={valorInicialSelector}
        ayuda={filtroModo === 'semana' ? 'Elegí un día; se usa toda su semana (lun–dom).' : undefined}
      />
    </>
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
  contenido: { padding: spacing.md, paddingBottom: spacing.xl, width: '100%', maxWidth: 900, alignSelf: 'center' },
  cabezal: { gap: spacing.md, marginBottom: spacing.md },
  item: { gap: 4, marginBottom: spacing.md },
  error: { color: colors.danger, textAlign: 'center' },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: acentoAlpha(0.1),
    borderWidth: 1,
    borderColor: colors.warning,
  },
  avisoTexto: { flex: 1, color: colors.warning, fontSize: 13, fontWeight: '600' },
  modos: { gap: spacing.sm },
  periodo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  periodoTexto: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
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
