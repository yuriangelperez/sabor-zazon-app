import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, SectionList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { CategoriaBase, CategoriaMomento, Producto, Relleno } from '@sabor/types';
import { acentoAlpha, Button, Chip, colors, radii, spacing, Text, TextInput } from '@sabor/ui';
import { CATEGORIAS_BASE, CATEGORIAS_MOMENTO, filtrarProductos, FILTROS_VACIOS, type FiltrosMenu, RELLENOS, SECCIONES_MENU } from '@sabor/utils';

import { CartBar } from '../../../components/CartBar';
import { ANCHO_MAXIMO, Contenedor } from '../../../components/Contenedor';
import { EstadoLocalBanner } from '../../../components/EstadoLocalBanner';
import { PedidoEnCursoBanner } from '../../../components/PedidoEnCursoBanner';
import { ProductCard } from '../../../components/ProductCard';
import { useProductos } from '../../../hooks/useProductos';

// RF-01 / RF-02 / RF-03: catálogo, búsqueda, filtros y agregado rápido al carrito.
export default function Menu() {
  const params = useLocalSearchParams<{ base?: CategoriaBase; momento?: CategoriaMomento }>();
  const { productos, cargando, error, refrescar } = useProductos();
  const { width } = useWindowDimensions();
  const [filtros, setFiltros] = useState<FiltrosMenu>({
    ...FILTROS_VACIOS,
    categoriaBase: params.base ?? null,
    categoriaMomento: params.momento ?? null,
  });
  const [verRellenos, setVerRellenos] = useState(false);

  const resultados = useMemo(() => filtrarProductos(productos, filtros), [productos, filtros]);
  const columnas = width >= 1000 ? 3 : width >= 700 ? 2 : 1;
  const secciones = useMemo(() => armarSecciones(resultados, columnas), [resultados, columnas]);
  const hayFiltros =
    filtros.texto !== '' || filtros.categoriaBase !== null || filtros.categoriaMomento !== null || filtros.rellenos.length > 0;

  const alternarBase = (id: CategoriaBase | null) =>
    setFiltros((f) => ({ ...f, categoriaBase: f.categoriaBase === id ? null : id }));
  const alternarMomento = (id: CategoriaMomento) =>
    setFiltros((f) => ({ ...f, categoriaMomento: f.categoriaMomento === id ? null : id }));
  const alternarRelleno = (id: Relleno) =>
    setFiltros((f) => ({
      ...f,
      rellenos: f.rellenos.includes(id) ? f.rellenos.filter((r) => r !== id) : [...f.rellenos, id],
    }));

  return (
    <View style={styles.pantalla}>
      <EstadoLocalBanner />
      <PedidoEnCursoBanner style={styles.pedidoEnCurso} />

      <View style={styles.filtros}>
        <Contenedor style={styles.buscadorFila}>
          <View style={styles.buscador}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={filtros.texto}
              onChangeText={(texto) => setFiltros((f) => ({ ...f, texto }))}
              placeholder="Buscá arepas, rellenos, combos…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              returnKeyType="search"
              autoCorrect={false}
            />
            {filtros.texto ? (
              <Pressable accessibilityLabel="Borrar búsqueda" onPress={() => setFiltros((f) => ({ ...f, texto: '' }))}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtrar por relleno"
            onPress={() => setVerRellenos((v) => !v)}
            style={[styles.botonFiltro, (verRellenos || filtros.rellenos.length > 0) && styles.botonFiltroActivo]}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={verRellenos || filtros.rellenos.length > 0 ? colors.sobreAcento : colors.textPrimary}
            />
          </Pressable>
        </Contenedor>

        <FilaChips>
          <Chip label="Todo" selected={filtros.categoriaBase === null} onPress={() => alternarBase(null)} />
          {CATEGORIAS_BASE.map((c) => (
            <Chip key={c.id} label={c.label} selected={filtros.categoriaBase === c.id} onPress={() => alternarBase(c.id)} />
          ))}
        </FilaChips>

        <FilaChips>
          {CATEGORIAS_MOMENTO.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              selected={filtros.categoriaMomento === c.id}
              onPress={() => alternarMomento(c.id)}
            />
          ))}
        </FilaChips>

        {verRellenos ? (
          <FilaChips titulo="Relleno">
            {RELLENOS.map((r) => (
              <Chip key={r.id} label={r.label} selected={filtros.rellenos.includes(r.id)} onPress={() => alternarRelleno(r.id)} />
            ))}
          </FilaChips>
        ) : null}
      </View>

      {cargando ? (
        <ActivityIndicator color={colors.acento} style={styles.cargando} />
      ) : error ? (
        <EstadoVacio titulo="No pudimos cargar el menú" texto={error} accion="Reintentar" onAccion={refrescar} />
      ) : (
        <SectionList
          sections={secciones}
          keyExtractor={(fila) => fila.map((p) => p.id).join('|')}
          renderItem={({ item: fila }) => (
            <View style={styles.fila}>
              {fila.map((p) => (
                <View key={p.id} style={styles.celda}>
                  <ProductCard producto={p} />
                </View>
              ))}
              {/* Celdas vacías para que la última fila no estire sus tarjetas */}
              {Array.from({ length: columnas - fila.length }, (_, i) => (
                <View key={`vacia-${i}`} style={styles.celda} />
              ))}
            </View>
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.seccion}>
              <View style={styles.seccionFila}>
                <Text style={styles.seccionTitulo}>{section.titulo}</Text>
                <Text style={styles.seccionCantidad}>{section.cantidad}</Text>
                <LinearGradient
                  colors={[acentoAlpha(0.25), 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.seccionDecor}
                />
              </View>
            </View>
          )}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EstadoVacio
              titulo="No encontramos productos"
              texto={
                hayFiltros
                  ? 'Probá con otra palabra o quitá algunos filtros.'
                  : 'Pronto vas a encontrar productos en esta sección.'
              }
              accion={hayFiltros ? 'Limpiar filtros' : undefined}
              onAccion={() => setFiltros(FILTROS_VACIOS)}
            />
          }
        />
      )}

      <CartBar />
    </View>
  );
}

interface SeccionMenu {
  id: CategoriaBase;
  titulo: string;
  cantidad: number;
  data: Producto[][]; // filas de `columnas` productos
}

// Agrupa los resultados por categoría (en el orden de SECCIONES_MENU) y
// parte cada sección en filas para la grilla. Las secciones vacías no se muestran.
function armarSecciones(productos: Producto[], columnas: number): SeccionMenu[] {
  return SECCIONES_MENU.flatMap(({ id, titulo }) => {
    const deLaSeccion = productos.filter((p) => p.categoriaBase === id);
    if (deLaSeccion.length === 0) return [];
    const filas: Producto[][] = [];
    for (let i = 0; i < deLaSeccion.length; i += columnas) {
      filas.push(deLaSeccion.slice(i, i + columnas));
    }
    return [{ id, titulo, cantidad: deLaSeccion.length, data: filas }];
  });
}

function FilaChips({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filaChips}
      contentContainerStyle={styles.filaChipsContenido}
    >
      {titulo ? <Text style={styles.filaTitulo}>{titulo}:</Text> : null}
      {children}
    </ScrollView>
  );
}

function EstadoVacio({
  titulo,
  texto,
  accion,
  onAccion,
}: {
  titulo: string;
  texto: string;
  accion?: string;
  onAccion?: () => void;
}) {
  return (
    <View style={styles.vacio}>
      <Ionicons name="fast-food-outline" size={40} color={colors.textMuted} />
      <Text style={styles.vacioTitulo}>{titulo}</Text>
      <Text style={styles.vacioTexto}>{texto}</Text>
      {accion && onAccion ? <Button label={accion} variante="contorno" onPress={onAccion} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  pedidoEnCurso: { paddingTop: spacing.sm },
  filtros: { paddingBottom: spacing.sm, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  buscadorFila: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm },
  buscador: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, color: colors.textPrimary, fontSize: 16, paddingVertical: 12 },
  botonFiltro: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  botonFiltroActivo: { backgroundColor: colors.acento, borderColor: colors.acento },
  filaChips: { flexGrow: 0, width: '100%', maxWidth: ANCHO_MAXIMO, alignSelf: 'center' },
  filaChipsContenido: { gap: spacing.sm, paddingHorizontal: spacing.md, alignItems: 'center' },
  filaTitulo: { color: colors.textSecondary, fontWeight: '600' },
  lista: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: 120,
    gap: spacing.md,
  },
  fila: { flexDirection: 'row', gap: spacing.md },
  celda: { flex: 1 },
  seccion: {
    backgroundColor: colors.background,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  seccionFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  seccionTitulo: { color: colors.acento, fontSize: 22, fontWeight: '600' },
  seccionCantidad: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  seccionDecor: { flex: 1, height: 1, marginLeft: spacing.xs },
  cargando: { marginTop: spacing.xl },
  vacio: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  vacioTitulo: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  vacioTexto: { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
});
