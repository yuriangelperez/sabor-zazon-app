import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { acentoAlpha, Button, colors, radii, spacing, Text } from '@sabor/ui';

export type ModoSelectorFecha = 'simple' | 'rango' | 'mes';

// `hasta` siempre es el límite superior EXCLUSIVO (el día siguiente a 00:00,
// o el mes siguiente a 00:00), así el consumidor no tiene que sumarle nada.
export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

interface SelectorFechaProps {
  titulo: string;
  modo: ModoSelectorFecha;
  visible: boolean;
  onClose: () => void;
  onConfirm: (rango: RangoFechas) => void;
  valorInicial?: RangoFechas | null;
  // Texto de ayuda opcional bajo el título (ej. para aclarar que el modo
  // Semana toma toda la semana del día elegido).
  ayuda?: string;
}

// Encabezado de días con la semana empezando en lunes (L D M M J V S).
const DIAS = ['L', 'D', 'M', 'M', 'J', 'V', 'S'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Convierte el getDay() de JS (domingo = 0) a un índice con lunes = 0.
function indiceLunesPrimero(fecha: Date): number {
  return (fecha.getDay() + 6) % 7;
}

// El día a 00:00 (sin tocar la fecha original).
function inicioDelDia(d: Date): Date {
  const copia = new Date(d);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

// El día siguiente a 00:00 (límite superior exclusivo).
function diaSiguiente(d: Date): Date {
  const copia = inicioDelDia(d);
  copia.setDate(copia.getDate() + 1);
  return copia;
}

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Calendario en hoja inferior. Reutiliza el patrón visual de Selector.tsx
// (fondo/hoja/agarre/título) y los tokens del tema. Sin dependencias nuevas:
// se arma la grilla mensual a mano. `simple` elige un día; `rango` pide dos
// toques (inicio y fin; si el fin es anterior al inicio, se reinicia el
// inicio); `mes` navega y confirma con "Usar este mes".
export function SelectorFecha({ titulo, modo, visible, onClose, onConfirm, valorInicial, ayuda }: SelectorFechaProps) {
  const insets = useSafeAreaInsets();
  const [mesVisto, setMesVisto] = useState<{ anio: number; mes: number }>(() => {
    const ref = valorInicial?.desde ?? new Date();
    return { anio: ref.getFullYear(), mes: ref.getMonth() };
  });
  const [diaElegido, setDiaElegido] = useState<Date | null>(null);
  const [inicio, setInicio] = useState<Date | null>(null);
  const [fin, setFin] = useState<Date | null>(null);

  // Reinicia la selección cada vez que se abre la hoja.
  useEffect(() => {
    if (!visible) return;
    const ref = valorInicial?.desde ?? new Date();
    setMesVisto({ anio: ref.getFullYear(), mes: ref.getMonth() });
    if (modo === 'simple') {
      setDiaElegido(valorInicial ? inicioDelDia(valorInicial.desde) : null);
      setInicio(null);
      setFin(null);
    } else if (modo === 'rango' && valorInicial) {
      setInicio(inicioDelDia(valorInicial.desde));
      // hasta es exclusivo: el último día inclusivo es el anterior a hasta.
      const ultimo = new Date(valorInicial.hasta);
      ultimo.setDate(ultimo.getDate() - 1);
      setFin(inicioDelDia(ultimo));
      setDiaElegido(null);
    } else {
      setInicio(null);
      setFin(null);
      setDiaElegido(null);
    }
  }, [visible, modo, valorInicial]);

  const navegarMes = (delta: number) => {
    setMesVisto((m) => {
      let mes = m.mes + delta;
      let anio = m.anio;
      if (mes < 0) {
        mes = 11;
        anio -= 1;
      } else if (mes > 11) {
        mes = 0;
        anio += 1;
      }
      return { anio, mes };
    });
  };

  const elegirDia = (dia: Date) => {
    if (modo === 'simple') {
      setDiaElegido(dia);
      return;
    }
    if (modo === 'rango') {
      // Sin inicio, o con inicio y fin ya elegidos: arranca un rango nuevo.
      if (!inicio || (inicio && fin)) {
        setInicio(dia);
        setFin(null);
        return;
      }
      // Hay inicio pero no fin.
      if (dia.getTime() < inicio.getTime()) {
        // El fin quedó antes del inicio: reinicia el inicio.
        setInicio(dia);
        setFin(null);
        return;
      }
      setFin(dia);
    }
    // modo 'mes': la grilla no es táctil; se confirma con el botón.
  };

  const confirmar = () => {
    if (modo === 'simple' && diaElegido) {
      onConfirm({ desde: diaElegido, hasta: diaSiguiente(diaElegido) });
    } else if (modo === 'rango' && inicio && fin) {
      onConfirm({ desde: inicio, hasta: diaSiguiente(fin) });
    } else if (modo === 'mes') {
      onConfirm({ desde: new Date(mesVisto.anio, mesVisto.mes, 1), hasta: new Date(mesVisto.anio, mesVisto.mes + 1, 1) });
    }
  };

  const puedeConfirmar = modo === 'mes' ? true : modo === 'rango' ? !!(inicio && fin) : !!diaElegido;
  const etiquetaBoton = modo === 'mes' ? 'Usar este mes' : modo === 'rango' ? 'Confirmar rango' : 'Confirmar';

  // Construye la grilla del mes visto (con casilleros vacíos al principio).
  const primerDia = new Date(mesVisto.anio, mesVisto.mes, 1);
  const diasEnMes = new Date(mesVisto.anio, mesVisto.mes + 1, 0).getDate();
  const celdas: (Date | null)[] = [];
  for (let i = 0; i < indiceLunesPrimero(primerDia); i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(new Date(mesVisto.anio, mesVisto.mes, d));
  while (celdas.length % 7 !== 0) celdas.push(null);

  const hoy = inicioDelDia(new Date());

  const esBorde = (dia: Date) => {
    if (modo === 'simple') return diaElegido ? mismoDia(dia, diaElegido) : false;
    if (modo === 'rango') return (inicio ? mismoDia(dia, inicio) : false) || (fin ? mismoDia(dia, fin) : false);
    return false;
  };
  const enRango = (dia: Date) => {
    if (modo !== 'rango' || !inicio || !fin) return false;
    return dia.getTime() >= inicio.getTime() && dia.getTime() <= fin.getTime();
  };

  const filas: (Date | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) filas.push(celdas.slice(i, i + 7));

  const ayudaRango =
    modo === 'rango'
      ? inicio && fin
        ? `Del ${inicio.getDate()} ${MESES[inicio.getMonth()]} al ${fin.getDate()} ${MESES[fin.getMonth()]}`
        : inicio
          ? 'Elegí el último día del rango'
          : 'Elegí el primer día del rango'
      : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.fondo} onPress={onClose} accessibilityLabel="Cerrar">
        <Pressable style={[styles.hoja, { paddingBottom: insets.bottom + spacing.md }]} onPress={() => {}}>
          <View style={styles.agarre} />
          <Text style={styles.titulo}>{titulo}</Text>
          {ayuda ? <Text style={styles.ayudaSuperior}>{ayuda}</Text> : null}

          <View style={styles.nav}>
            <Pressable onPress={() => navegarMes(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Mes anterior">
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.mesAnio}>
              {MESES[mesVisto.mes]} {mesVisto.anio}
            </Text>
            <Pressable onPress={() => navegarMes(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Mes siguiente">
              <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.encabezadoDias}>
            {DIAS.map((d, i) => (
              <Text key={i} style={styles.diaEncabezado}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grilla}>
            {filas.map((fila, fi) => (
              <View key={fi} style={styles.filaGrilla}>
                {fila.map((dia, ci) => {
                  if (!dia) return <View key={ci} style={styles.celda} />;
                  const borde = esBorde(dia);
                  const dentro = enRango(dia);
                  const esHoy = mismoDia(dia, hoy);
                  return (
                    <Pressable
                      key={ci}
                      onPress={() => elegirDia(dia)}
                      disabled={modo === 'mes'}
                      accessibilityRole="button"
                      accessibilityLabel={`${dia.getDate()} de ${MESES[dia.getMonth()]}`}
                      style={[styles.celda, dentro && styles.celdaDentro, borde && styles.celdaBorde]}
                    >
                      <Text style={[styles.celdaTexto, esHoy && !borde && styles.celdaHoy, borde && styles.celdaTextoBorde]}>
                        {dia.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {ayudaRango ? <Text style={styles.ayuda}>{ayudaRango}</Text> : null}

          <View style={styles.acciones}>
            <Button label="Cancelar" variante="contorno" onPress={onClose} style={styles.botonAccion} />
            <Button label={etiquetaBoton} variante="primario" onPress={confirmar} disabled={!puedeConfirmar} style={styles.botonAccion} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  hoja: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 3,
    borderTopColor: colors.acento,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  agarre: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  titulo: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: spacing.sm },
  ayudaSuperior: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.sm },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  mesAnio: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  encabezadoDias: { flexDirection: 'row', marginBottom: spacing.xs },
  diaEncabezado: { flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  grilla: { gap: 2 },
  filaGrilla: { flexDirection: 'row', gap: 2 },
  celda: { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: radii.sm },
  celdaDentro: { backgroundColor: acentoAlpha(0.15) },
  celdaBorde: { backgroundColor: colors.acento },
  celdaTexto: { color: colors.textPrimary, fontSize: 15 },
  celdaHoy: { color: colors.acento, fontWeight: '700' },
  celdaTextoBorde: { color: colors.sobreAcento, fontWeight: '700' },
  ayuda: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
  acciones: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  botonAccion: { flex: 1 },
});
