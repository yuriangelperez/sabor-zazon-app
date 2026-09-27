import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CategoriaBase, Producto } from '@sabor/types';
import { cambiarDisponibilidad, mensajeError } from '@sabor/api-client';
import { Button, Chip, colors, fuenteImagen, radii, Selector, spacing, Text, TextInput } from '@sabor/ui';
import {
  estadoDisponibilidad,
  FILTROS_VACIOS,
  filtrarProductos,
  finDelDia,
  formatPrice,
  precioConDescuento,
  SECCIONES_MENU,
  type EstadoDisponibilidad,
} from '@sabor/utils';

import { IngredientesPanel } from '../../components/IngredientesPanel';
import { PreciosRellenosPanel } from '../../components/PreciosRellenosPanel';
import { useMenuAdmin } from '../../hooks/useMenuAdmin';

type Vista = 'productos' | 'ingredientes' | 'rellenos';

const DISPONIBILIDAD: { id: EstadoDisponibilidad; label: string; detalle: string }[] = [
  { id: 'disponible', label: 'Disponible', detalle: 'Se ve en el menú' },
  { id: 'sin_stock_hoy', label: 'Sin stock hoy', detalle: 'Vuelve mañana' },
  { id: 'desactivado', label: 'Desactivado', detalle: 'Oculto hasta reactivarlo' },
];

// RF-12: administración del menú: productos (buscar, filtrar,
// activar/desactivar, editar), ingredientes agotados y precios de relleno.
export default function MenuAdmin() {
  const { productos, ingredientes, cargando, error, recargar } = useMenuAdmin();
  const [vista, setVista] = useState<Vista>('productos');
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState<CategoriaBase | null>(null);
  const [estado, setEstado] = useState<EstadoDisponibilidad | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const secciones = useMemo(() => {
    const filtrados = filtrarProductos(productos, { ...FILTROS_VACIOS, texto, categoriaBase: categoria }, { soloDisponibles: false })
      .filter((p) => !estado || estadoDisponibilidad(p) === estado);
    return SECCIONES_MENU.map((s) => ({ ...s, data: filtrados.filter((p) => p.categoriaBase === s.id) })).filter(
      (s) => s.data.length > 0
    );
  }, [productos, texto, categoria, estado]);

  const onDisponibilidad = async (producto: Producto, modo: EstadoDisponibilidad) => {
    setErrorAccion(null);
    try {
      await cambiarDisponibilidad(producto.id, modo, modo === 'sin_stock_hoy' ? finDelDia() : undefined);
    } catch (err) {
      setErrorAccion(mensajeError(err, 'No se pudo cambiar la disponibilidad.'));
    }
  };

  if (cargando) return <ActivityIndicator color={colors.acento} style={{ marginTop: spacing.xl }} />;

  const agotados = ingredientes.filter((i) => i.agotado).length;
  const pestanas = (
    <View style={styles.pestanas}>
      {(
        [
          { id: 'productos', label: 'Productos' },
          { id: 'ingredientes', label: agotados > 0 ? `Ingredientes (${agotados} agotado${agotados === 1 ? '' : 's'})` : 'Ingredientes' },
          { id: 'rellenos', label: 'Rellenos' },
        ] as const
      ).map((p) => (
        <Pressable
          key={p.id}
          onPress={() => setVista(p.id)}
          accessibilityRole="tab"
          accessibilityState={{ selected: vista === p.id }}
          style={[styles.pestana, vista === p.id && styles.pestanaActiva]}
        >
          <Text
            style={[styles.pestanaTexto, vista === p.id && styles.pestanaTextoActivo, p.id === 'ingredientes' && agotados > 0 && vista !== p.id && { color: colors.danger }]}
            numberOfLines={1}
          >
            {p.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  if (vista !== 'productos') {
    return (
      <View style={styles.pantalla}>
        {pestanas}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {vista === 'ingredientes' ? (
          <IngredientesPanel ingredientes={ingredientes} productos={productos} onCambio={recargar} />
        ) : (
          <PreciosRellenosPanel productos={productos} onCambio={recargar} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.pantalla}>
      {pestanas}
      <View style={styles.barra}>
        <View style={styles.buscadorFila}>
          <View style={styles.buscador}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Buscar producto, relleno…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>
          <Button label="Nuevo" icono={<Ionicons name="add" size={18} color={colors.sobreAcento} />} onPress={() => router.push('/producto/nuevo')} style={styles.nuevo} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Todo" selected={categoria === null} onPress={() => setCategoria(null)} />
          {SECCIONES_MENU.map((s) => (
            <Chip key={s.id} label={s.titulo} selected={categoria === s.id} onPress={() => setCategoria(categoria === s.id ? null : s.id)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {DISPONIBILIDAD.map((d) => (
            <Chip key={d.id} label={d.label} selected={estado === d.id} onPress={() => setEstado(estado === d.id ? null : d.id)} />
          ))}
        </ScrollView>
      </View>

      {error || errorAccion ? <Text style={styles.error}>{error ?? errorAccion}</Text> : null}

      <SectionList
        sections={secciones}
        keyExtractor={(p) => p.id}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.lista}
        renderSectionHeader={({ section }) => (
          <Text style={styles.seccion}>
            {section.titulo} <Text style={styles.seccionCantidad}>({section.data.length})</Text>
          </Text>
        )}
        renderItem={({ item }) => <FilaProducto producto={item} onDisponibilidad={onDisponibilidad} />}
        ListEmptyComponent={<Text style={styles.vacio}>No hay productos con esos filtros.</Text>}
      />
    </View>
  );
}

function FilaProducto({
  producto,
  onDisponibilidad,
}: {
  producto: Producto;
  onDisponibilidad: (p: Producto, modo: EstadoDisponibilidad) => void;
}) {
  const estado = estadoDisponibilidad(producto);
  const descuento = producto.descuentoPorcentaje ?? 0;

  return (
    <View style={[styles.fila, estado !== 'disponible' && styles.filaInactiva]}>
      <Pressable style={styles.filaInfo} onPress={() => router.push(`/producto/${producto.id}`)} accessibilityRole="button">
        <Image source={fuenteImagen(producto.imagen)} style={styles.imagen} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.nombre} numberOfLines={1}>
            {producto.nombre}
          </Text>
          <View style={styles.etiquetas}>
            <Text style={styles.precio}>{formatPrice(precioConDescuento(producto))}</Text>
            {descuento > 0 ? <Etiqueta texto={`-${descuento}%`} color={colors.rojo} /> : null}
            {producto.esCombo ? <Etiqueta texto="Combo" color={colors.azul} /> : null}
            {producto.agotado ? <Etiqueta texto="Ingrediente agotado" color={colors.cerrado} /> : null}
          </View>
        </View>
        <Ionicons name="create-outline" size={20} color={colors.textMuted} />
      </Pressable>
      <View style={styles.selector}>
        <Selector
          titulo={producto.nombre}
          valor={estado}
          opciones={DISPONIBILIDAD.map((d) => ({ id: d.id, label: d.label, detalle: d.detalle }))}
          onChange={(id) => onDisponibilidad(producto, id as EstadoDisponibilidad)}
        />
      </View>
    </View>
  );
}

function Etiqueta({ texto, color }: { texto: string; color: string }) {
  return (
    <View style={[styles.etiqueta, { backgroundColor: color }]}>
      <Text style={styles.etiquetaTexto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  pestanas: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pestana: { flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: radii.sm },
  pestanaActiva: { backgroundColor: colors.acento },
  pestanaTexto: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  pestanaTextoActivo: { color: colors.sobreAcento },
  barra: { gap: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  buscadorFila: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
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
  input: { flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 10 },
  nuevo: { paddingHorizontal: spacing.md, paddingVertical: 10 },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.md },
  error: { color: colors.danger, padding: spacing.sm, textAlign: 'center' },

  lista: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm, width: '100%', maxWidth: 900, alignSelf: 'center' },
  seccion: { color: colors.acento, fontSize: 18, fontWeight: '600', backgroundColor: colors.background, paddingVertical: spacing.sm },
  seccionCantidad: { color: colors.textMuted, fontSize: 13 },
  vacio: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },

  fila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  filaInactiva: { opacity: 0.6 },
  filaInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexGrow: 1, flexBasis: 260 },
  imagen: { width: 56, height: 56, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt },
  nombre: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  precio: { color: colors.acento, fontSize: 14, fontWeight: '700' },
  etiqueta: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 1 },
  etiquetaTexto: { color: colors.textPrimary, fontSize: 11, fontWeight: '600' },
  selector: { flexGrow: 1, flexBasis: 170, maxWidth: 240 },
});
