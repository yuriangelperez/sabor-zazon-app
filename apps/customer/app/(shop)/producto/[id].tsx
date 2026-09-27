import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { GrupoOpciones, OpcionElegida, OpcionGrupo } from '@sabor/types';
import { Button, Chip, colors, fuenteImagen, QuantityStepper, radii, Selector, spacing, Text, typography } from '@sabor/ui';
import { cantidadElegidaEnGrupo, formatPrice, grupoCompleto, nombreVisibleGrupo, opcionesPorDefecto, opcionesValidas, precioConDescuento, precioUnitario, RELLENOS } from '@sabor/utils';

import { Contenedor } from '../../../components/Contenedor';
import { useProducto } from '../../../hooks/useProducto';
import { useCarritoStore } from '../../../stores/useCarritoStore';

const ANCHO_DETALLE = 720;

// RF-04: detalle del producto. Los combos llegan acá obligatoriamente para
// elegir sus opciones antes de agregarse al carrito.
export default function DetalleProducto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { producto, cargando, error } = useProducto(id);
  const agregarItem = useCarritoStore((s) => s.agregarItem);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [opciones, setOpciones] = useState<OpcionElegida[]>([]);
  const [cantidad, setCantidad] = useState(1);

  useEffect(() => {
    if (producto) setOpciones(opcionesPorDefecto(producto));
  }, [producto]);

  if (cargando) {
    return <ActivityIndicator color={colors.acento} style={{ marginTop: spacing.xl }} />;
  }

  if (!producto) {
    return (
      <View style={styles.noEncontrado}>
        <Text style={styles.titulo}>{error ?? 'Este producto no está disponible'}</Text>
        <Button label="Ir al menú" onPress={() => router.replace('/menu')} />
      </View>
    );
  }

  const grupos = producto.gruposOpciones ?? [];
  const valido = opcionesValidas(producto, opciones);
  const total = precioUnitario(producto, opciones) * cantidad;
  const pendiente = grupos.find((g) => !grupoCompleto(g, opciones));
  const tieneDescuento = (producto.descuentoPorcentaje ?? 0) > 0;
  const rellenos = RELLENOS.filter((r) => producto.rellenos?.includes(r.id));

  const elegirUnica = (grupo: GrupoOpciones, opcion: OpcionGrupo) => {
    setOpciones((prev) => [
      ...prev.filter((o) => o.grupoId !== grupo.id),
      {
        grupoId: grupo.id,
        grupoNombre: nombreVisibleGrupo(grupo),
        opcionId: opcion.id,
        nombre: opcion.nombre,
        cantidad: 1,
        precioAdicional: opcion.precioAdicional,
      },
    ]);
  };

  const cambiarCantidadOpcion = (grupo: GrupoOpciones, opcion: OpcionGrupo, nueva: number) => {
    setOpciones((prev) => {
      const resto = prev.filter((o) => !(o.grupoId === grupo.id && o.opcionId === opcion.id));
      if (nueva <= 0) return resto;
      return [
        ...resto,
        {
          grupoId: grupo.id,
          grupoNombre: nombreVisibleGrupo(grupo),
          opcionId: opcion.id,
          nombre: opcion.nombre,
          cantidad: nueva,
          precioAdicional: opcion.precioAdicional,
        },
      ];
    });
  };

  const onAgregar = () => {
    agregarItem({ producto, cantidad, opciones });
    if (router.canGoBack()) router.back();
    else router.replace('/menu');
  };

  return (
    <View style={styles.pantalla}>
      <Stack.Screen options={{ title: producto.nombre }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}>
        <Contenedor style={styles.contenido}>
          <Image
            source={fuenteImagen(producto.imagen)}
            style={[styles.imagen, { height: altoImagen(width) }]}
            resizeMode="cover"
          />

          <Text style={styles.titulo}>{producto.nombre}</Text>
          <View style={styles.precios}>
            <Text style={styles.precio}>{formatPrice(precioConDescuento(producto))}</Text>
            {tieneDescuento ? (
              <>
                <Text style={styles.precioOriginal}>{formatPrice(producto.precio)}</Text>
                <Text style={styles.descuento}>-{producto.descuentoPorcentaje}%</Text>
              </>
            ) : null}
          </View>
          <Text style={styles.descripcion}>{producto.descripcion}</Text>

          {rellenos.length > 0 ? (
            <View style={styles.etiquetas}>
              {rellenos.map((r) => (
                <View key={r.id} style={styles.etiqueta}>
                  <Text style={styles.etiquetaTexto}>{r.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {producto.acompañamientos?.length ? (
            <View style={styles.incluye}>
              <Ionicons name="gift-outline" size={18} color={colors.acento} />
              <Text style={styles.incluyeTexto}>Incluye: {producto.acompañamientos.join(', ')}</Text>
            </View>
          ) : null}

          {agruparEnBloques(grupos).map((bloque) =>
            bloque.tipo === 'combo' ? (
              <BloqueCombo
                key={bloque.clave}
                titulo={bloque.titulo}
                secciones={bloque.secciones}
                opciones={opciones}
                onElegir={elegirUnica}
              />
            ) : (
              <TarjetaGrupo
                key={bloque.grupo.id}
                grupo={bloque.grupo}
                opciones={opciones}
                onElegirUnica={elegirUnica}
                onCambiarCantidad={cambiarCantidadOpcion}
              />
            )
          )}
        </Contenedor>
      </ScrollView>

      <View style={[styles.barra, { paddingBottom: insets.bottom + spacing.md }]}>
        <Contenedor style={styles.barraContenido}>
          {pendiente ? (
            <Text style={styles.aviso}>Falta completar: {descripcionPendiente(pendiente, opciones)}</Text>
          ) : null}
          <View style={styles.barraFila}>
            <QuantityStepper value={cantidad} onChange={setCantidad} min={1} disabled={producto.agotado} />
            <Button
              label={producto.agotado ? 'Agotado' : `Agregar · ${formatPrice(total)}`}
              onPress={onAgregar}
              disabled={!valido || producto.agotado}
              style={styles.botonAgregar}
            />
          </View>
        </Contenedor>
      </View>
    </View>
  );
}

// La imagen se dimensiona según el ancho real disponible (pantalla menos
// márgenes) para que en el celular nunca se salga ni quede descentrada.
function altoImagen(anchoPantalla: number) {
  const anchoDisponible = Math.min(anchoPantalla, ANCHO_DETALLE) - spacing.md * 2;
  return Math.round(Math.min(240, (anchoDisponible * 9) / 16));
}

interface Seccion {
  nombre: string; // "Arepa 1"
  grupos: GrupoOpciones[]; // Relleno, Cocción
}

type Bloque =
  | { tipo: 'combo'; clave: string; titulo: string; secciones: Seccion[] }
  | { tipo: 'grupo'; grupo: GrupoOpciones };

const TITULOS_COMBO: Partial<Record<string, string>> = {
  arepa: 'Armá tus arepas',
  empanada: 'Armá tus empanadas',
};

// Los grupos con sección (las piezas de un combo) se juntan en un bloque por
// categoría: todas las arepas en una tarjeta, todas las empanadas en otra.
// Los grupos sueltos (ej. la cocción de una arepa individual) van aparte.
function agruparEnBloques(grupos: GrupoOpciones[]): Bloque[] {
  const bloques: Bloque[] = [];
  for (const grupo of grupos) {
    if (!grupo.seccion) {
      bloques.push({ tipo: 'grupo', grupo });
      continue;
    }
    const categoria = grupo.categoria ?? 'opciones';
    let bloque = bloques[bloques.length - 1];
    if (bloque?.tipo !== 'combo' || bloque.clave !== categoria) {
      bloque = { tipo: 'combo', clave: categoria, titulo: TITULOS_COMBO[categoria] ?? 'Elegí tus opciones', secciones: [] };
      bloques.push(bloque);
    }
    const seccion = bloque.secciones.find((s) => s.nombre === grupo.seccion);
    if (seccion) seccion.grupos.push(grupo);
    else bloque.secciones.push({ nombre: grupo.seccion, grupos: [grupo] });
  }
  return bloques;
}

function descripcionPendiente(grupo: GrupoOpciones, opciones: OpcionElegida[]) {
  if (grupo.seccion) return `${grupo.seccion} (${grupo.nombre.toLowerCase()})`;
  if (grupo.tipo === 'cantidad') {
    return `${grupo.nombre.toLowerCase()} (${cantidadElegidaEnGrupo(grupo, opciones)}/${grupo.maximo})`;
  }
  return grupo.nombre.toLowerCase();
}

function EstadoGrupo({ completo, texto }: { completo: boolean; texto: string }) {
  return (
    <View style={[styles.grupoEstado, completo && styles.grupoEstadoCompleto]}>
      <Text style={[styles.grupoEstadoTexto, completo && { color: colors.sobreAcento }]}>{texto}</Text>
    </View>
  );
}

// Piezas de un combo: una fila por arepa/empanada con listas desplegables
// ("Arepa 1: [Pelúa ▾]  Cocción: [Frita ▾]").
function BloqueCombo({
  titulo,
  secciones,
  opciones,
  onElegir,
}: {
  titulo: string;
  secciones: Seccion[];
  opciones: OpcionElegida[];
  onElegir: (grupo: GrupoOpciones, opcion: OpcionGrupo) => void;
}) {
  const listas = secciones.filter((s) => s.grupos.every((g) => grupoCompleto(g, opciones))).length;
  const completo = listas === secciones.length;
  // Si cada pieza tiene una sola elección (ej. empanadas: solo relleno),
  // van de a dos por fila para ocupar menos espacio.
  const dosPorFila = secciones.every((s) => s.grupos.length === 1);

  return (
    <View style={styles.grupo}>
      <View style={styles.grupoEncabezado}>
        <Text style={[styles.grupoTitulo, { flex: 1 }]}>{titulo}</Text>
        <EstadoGrupo completo={completo} texto={completo ? 'Listo' : `${listas}/${secciones.length}`} />
      </View>

      <View style={dosPorFila ? styles.grillaCombo : styles.listaCombo}>
        {secciones.map((seccion) => (
          <View key={seccion.nombre} style={[styles.filaCombo, dosPorFila && styles.celdaCombo]}>
            {seccion.grupos.map((grupo, i) => {
              const elegida = opciones.find((o) => o.grupoId === grupo.id);
              return (
                <View key={grupo.id} style={[styles.columnaCombo, i === 0 && styles.columnaPrincipal]}>
                  <Text style={styles.etiquetaCampo}>{i === 0 ? seccion.nombre : grupo.nombre}</Text>
                  <Selector
                    titulo={`${seccion.nombre} · ${grupo.nombre}`}
                    valor={elegida?.opcionId ?? null}
                    placeholder={`Elegí ${grupo.nombre.toLowerCase()}`}
                    opciones={grupo.opciones.map((o) => ({
                      id: o.id,
                      label: o.nombre,
                      detalle: o.precioAdicional > 0 ? `+${formatPrice(o.precioAdicional)}` : undefined,
                      deshabilitada: o.agotado,
                    }))}
                    onChange={(id) => {
                      const opcion = grupo.opciones.find((o) => o.id === id);
                      if (opcion) onElegir(grupo, opcion);
                    }}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// Grupo suelto: chips para elegir una opción o selectores -2+ por cantidad.
function TarjetaGrupo({
  grupo,
  opciones,
  onElegirUnica,
  onCambiarCantidad,
}: {
  grupo: GrupoOpciones;
  opciones: OpcionElegida[];
  onElegirUnica: (grupo: GrupoOpciones, opcion: OpcionGrupo) => void;
  onCambiarCantidad: (grupo: GrupoOpciones, opcion: OpcionGrupo, cantidad: number) => void;
}) {
  const completo = grupoCompleto(grupo, opciones);
  const elegidas = cantidadElegidaEnGrupo(grupo, opciones);
  const restantes = grupo.maximo - elegidas;
  const rango = grupo.minimo === grupo.maximo ? `${grupo.maximo}` : `${grupo.minimo} a ${grupo.maximo}`;

  return (
    <View style={styles.grupo}>
      <View style={styles.grupoEncabezado}>
        <View style={{ flex: 1 }}>
          <Text style={styles.grupoTitulo}>{grupo.nombre}</Text>
          {grupo.tipo === 'cantidad' ? <Text style={styles.grupoAyuda}>Elegí {rango} en total</Text> : null}
        </View>
        <EstadoGrupo
          completo={completo}
          texto={grupo.tipo === 'cantidad' ? `${elegidas}/${grupo.maximo}` : completo ? 'Listo' : 'Obligatorio'}
        />
      </View>

      {grupo.tipo === 'unica' ? (
        <View style={styles.unicas}>
          {grupo.opciones.map((o) => (
            <Chip
              key={o.id}
              label={o.precioAdicional > 0 ? `${o.nombre} (+${formatPrice(o.precioAdicional)})` : o.nombre}
              selected={opciones.some((e) => e.grupoId === grupo.id && e.opcionId === o.id)}
              onPress={o.agotado ? undefined : () => onElegirUnica(grupo, o)}
            />
          ))}
        </View>
      ) : (
        grupo.opciones.map((o) => {
          const actual = opciones.find((e) => e.grupoId === grupo.id && e.opcionId === o.id)?.cantidad ?? 0;
          return (
            <View key={o.id} style={styles.opcion}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.opcionNombre, o.agotado && styles.opcionAgotada]}>{o.nombre}</Text>
                {o.agotado ? (
                  <Text style={styles.opcionExtra}>Agotado</Text>
                ) : o.precioAdicional > 0 ? (
                  <Text style={styles.opcionExtra}>+{formatPrice(o.precioAdicional)} c/u</Text>
                ) : null}
              </View>
              <QuantityStepper
                value={actual}
                onChange={(n) => onCambiarCantidad(grupo, o, n)}
                max={actual + restantes}
                size="sm"
                disabled={o.agotado}
              />
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { maxWidth: ANCHO_DETALLE, gap: spacing.sm, paddingTop: spacing.md },
  noEncontrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  imagen: { width: '100%', borderRadius: radii.md, backgroundColor: colors.surface },
  titulo: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.sm },
  precios: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  precio: { color: colors.acento, fontSize: 22, fontWeight: '800' },
  precioOriginal: { color: colors.textMuted, fontSize: 15, textDecorationLine: 'line-through' },
  descuento: { color: colors.rojo, fontWeight: '800' },
  descripcion: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  etiqueta: { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  etiquetaTexto: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  incluye: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  incluyeTexto: { color: colors.textPrimary, flex: 1 },

  grupo: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  grupoEncabezado: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grupoTitulo: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  grupoAyuda: { color: colors.textMuted, fontSize: 13 },
  grupoEstado: { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  grupoEstadoCompleto: { backgroundColor: colors.success },
  grupoEstadoTexto: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  listaCombo: { gap: spacing.sm },
  grillaCombo: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filaCombo: { flexDirection: 'row', gap: spacing.sm },
  celdaCombo: { flexBasis: '47%', flexGrow: 1 },
  columnaCombo: { flex: 1, gap: 4 },
  columnaPrincipal: { flex: 1.3 },
  etiquetaCampo: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  unicas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  opcionNombre: { color: colors.textPrimary, fontSize: 15 },
  opcionAgotada: { color: colors.textMuted, textDecorationLine: 'line-through' },
  opcionExtra: { color: colors.acento, fontSize: 12 },

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
  barraContenido: { maxWidth: ANCHO_DETALLE, gap: spacing.sm },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  botonAgregar: { flex: 1 },
  aviso: { color: colors.acento, fontSize: 13, textAlign: 'center' },
});
