import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import type { CategoriaBase, CategoriaMomento, GrupoOpciones, Ingrediente, Producto, Relleno } from '@sabor/types';
import {
  eliminarProducto,
  getIngredientes,
  getProductoById,
  getProductos,
  guardarProducto,
  mensajeError,
  subirImagenProducto,
} from '@sabor/api-client';
import { Button, Chip, colors, fuenteImagen, QuantityStepper, radii, Selector, spacing, Text, TextInput } from '@sabor/ui';
import {
  CATEGORIAS_MOMENTO,
  gruposParaProducto,
  piezasDeCombo,
  preciosDeRellenos,
  RELLENOS,
  SECCIONES_MENU,
} from '@sabor/utils';

interface Formulario {
  nombre: string;
  descripcion: string;
  categoria: CategoriaBase;
  precio: string;
  descuento: string;
  momentos: CategoriaMomento[];
  rellenos: Relleno[];
  ingredientes: string[];
  esCombo: boolean;
  arepas: number;
  empanadas: number;
  acompanamientos: string;
}

const VACIO: Formulario = {
  nombre: '',
  descripcion: '',
  categoria: 'arepa',
  precio: '',
  descuento: '0',
  momentos: [],
  rellenos: [],
  ingredientes: [],
  esCombo: false,
  arepas: 2,
  empanadas: 0,
  acompanamientos: '',
};

function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

// RF-12: alta y edición de productos.
export default function EditorProducto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const esNuevo = id === 'nuevo';
  const insets = useSafeAreaInsets();

  const [original, setOriginal] = useState<Producto | null>(null);
  const [form, setForm] = useState<Formulario>(VACIO);
  const [opcionesTocadas, setOpcionesTocadas] = useState(esNuevo);
  const [imagen, setImagen] = useState<string>('');
  const [imagenLocal, setImagenLocal] = useState<{ uri: string; tipo: string } | null>(null);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [cargando, setCargando] = useState(!esNuevo);
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getIngredientes().then(setIngredientes).catch(() => setIngredientes([]));
    if (esNuevo) return;
    getProductoById(id)
      .then((p) => {
        if (!p) {
          setError('Este producto ya no existe.');
          return;
        }
        const piezas = piezasDeCombo(p.gruposOpciones);
        setOriginal(p);
        setImagen(typeof p.imagen === 'string' ? p.imagen : '');
        setForm({
          nombre: p.nombre,
          descripcion: p.descripcion,
          categoria: p.categoriaBase,
          precio: String(p.precio),
          descuento: String(p.descuentoPorcentaje ?? 0),
          momentos: p.categoriasMomento,
          rellenos: p.rellenos ?? [],
          ingredientes: p.ingredientes ?? [],
          esCombo: p.esCombo,
          arepas: piezas.arepas,
          empanadas: piezas.empanadas,
          acompanamientos: (p.acompañamientos ?? []).join(', '),
        });
      })
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, [id, esNuevo]);

  const cambiar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => setForm((f) => ({ ...f, [campo]: valor }));

  // Cambios que regeneran las opciones del producto (piezas del combo, cocción).
  const cambiarOpciones = <K extends 'categoria' | 'esCombo' | 'arepas' | 'empanadas'>(campo: K, valor: Formulario[K]) => {
    setOpcionesTocadas(true);
    setForm((f) => {
      const nuevo = { ...f, [campo]: valor };
      if (campo === 'categoria') nuevo.esCombo = valor === 'combo';
      return nuevo;
    });
  };

  const elegirFoto = async () => {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!resultado.canceled && resultado.assets[0]) {
      const asset = resultado.assets[0];
      setImagenLocal({ uri: asset.uri, tipo: asset.mimeType ?? 'image/jpeg' });
    }
  };

  const precio = Number(form.precio.replace(/\D/g, ''));
  const descuento = Math.min(100, Math.max(0, Number(form.descuento.replace(/\D/g, '')) || 0));
  const valido = form.nombre.trim().length > 0 && precio > 0;

  const guardar = async () => {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      const imagenFinal = imagenLocal ? await subirImagenProducto(imagenLocal.uri, imagenLocal.tipo) : imagen;
      const grupos: GrupoOpciones[] = opcionesTocadas
        ? gruposParaProducto(
            form.categoria,
            form.esCombo,
            { arepas: form.arepas, empanadas: form.empanadas },
            // Los rellenos del combo nuevo cuestan lo mismo que en los demás.
            form.esCombo ? preciosDeRellenos(await getProductos()) : undefined
          )
        : (original?.gruposOpciones ?? []);

      await guardarProducto({
        id: original?.id ?? '',
        nombre: form.nombre,
        descripcion: form.descripcion,
        imagen: imagenFinal,
        precio,
        descuentoPorcentaje: descuento,
        categoriaBase: form.categoria,
        categoriasMomento: form.momentos,
        rellenos: form.rellenos,
        esCombo: form.esCombo,
        gruposOpciones: grupos,
        acompañamientos: form.acompanamientos
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        ingredientes: form.ingredientes,
        activo: original?.activo ?? true,
        desactivadoHasta: original?.desactivadoHasta ?? null,
        orden: original?.orden ?? 99,
      });
      router.back();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar el producto.'));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!original) return;
    setGuardando(true);
    try {
      await eliminarProducto(original.id);
      router.back();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo eliminar el producto.'));
      setGuardando(false);
    }
  };

  if (cargando) return <ActivityIndicator color={colors.acento} style={{ marginTop: spacing.xl }} />;

  const fuenteFoto = imagenLocal ? { uri: imagenLocal.uri } : fuenteImagen(imagen);

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: esNuevo ? 'Nuevo producto' : form.nombre || 'Producto' }} />
      <ScrollView contentContainerStyle={[styles.contenido, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled">
        <Seccion titulo="Foto">
          <View style={styles.fotoFila}>
            {fuenteFoto ? (
              <Image source={fuenteFoto} style={styles.foto} />
            ) : (
              <View style={[styles.foto, styles.fotoVacia]}>
                <Ionicons name="image-outline" size={28} color={colors.textMuted} />
              </View>
            )}
            <Button label={fuenteFoto ? 'Cambiar foto' : 'Elegir foto'} variante="contorno" onPress={elegirFoto} />
          </View>
        </Seccion>

        <Seccion titulo="Datos">
          <Campo etiqueta="Nombre">
            <TextInput value={form.nombre} onChangeText={(v) => cambiar('nombre', v)} style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Ej: Arepa Reina Pepiada" />
          </Campo>
          <Campo etiqueta="Descripción">
            <TextInput
              value={form.descripcion}
              onChangeText={(v) => cambiar('descripcion', v)}
              multiline
              style={[styles.input, styles.multilinea]}
              placeholderTextColor={colors.textMuted}
              placeholder="Qué lleva, cómo se sirve…"
            />
          </Campo>
          <Campo etiqueta="Categoría">
            <Selector
              titulo="Categoría"
              valor={form.categoria}
              opciones={SECCIONES_MENU.map((s) => ({ id: s.id, label: s.titulo }))}
              onChange={(v) => cambiarOpciones('categoria', v as CategoriaBase)}
            />
          </Campo>
          <View style={styles.dosColumnas}>
            <Campo etiqueta="Precio ($)" flex>
              <TextInput value={form.precio} onChangeText={(v) => cambiar('precio', v)} keyboardType="number-pad" style={styles.input} placeholder="9449" placeholderTextColor={colors.textMuted} />
            </Campo>
            <Campo etiqueta="Descuento (%)" flex>
              <TextInput value={form.descuento} onChangeText={(v) => cambiar('descuento', v)} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.textMuted} />
            </Campo>
          </View>
          {descuento > 0 ? <Text style={styles.ayuda}>Con descuento aparece automáticamente en Promociones.</Text> : null}
        </Seccion>

        <Seccion titulo="Momentos del día">
          <View style={styles.chips}>
            {CATEGORIAS_MOMENTO.map((m) => (
              <Chip key={m.id} label={m.label} selected={form.momentos.includes(m.id)} onPress={() => cambiar('momentos', alternar(form.momentos, m.id))} />
            ))}
          </View>
        </Seccion>

        <Seccion titulo="Rellenos (para los filtros del menú)">
          <View style={styles.chips}>
            {RELLENOS.map((r) => (
              <Chip key={r.id} label={r.label} selected={form.rellenos.includes(r.id)} onPress={() => cambiar('rellenos', alternar(form.rellenos, r.id))} />
            ))}
          </View>
        </Seccion>

        <Seccion titulo="Ingredientes">
          <Text style={styles.ayuda}>Si marcás uno como agotado en Ajustes, este producto se oculta solo.</Text>
          <View style={styles.chips}>
            {ingredientes.map((i) => (
              <Chip key={i.id} label={i.nombre} selected={form.ingredientes.includes(i.id)} onPress={() => cambiar('ingredientes', alternar(form.ingredientes, i.id))} />
            ))}
          </View>
        </Seccion>

        <Seccion titulo="Combo">
          <View style={styles.switchFila}>
            <Text style={styles.switchTexto}>Es un combo (lleva al detalle para armarlo)</Text>
            <Switch
              value={form.esCombo}
              onValueChange={(v) => cambiarOpciones('esCombo', v)}
              trackColor={{ true: colors.acento, false: colors.surfaceAlt }}
              thumbColor={colors.textPrimary}
            />
          </View>
          {form.esCombo ? (
            <>
              <FilaCantidad etiqueta="Arepas a elegir (relleno + cocción)" valor={form.arepas} onChange={(v) => cambiarOpciones('arepas', v)} />
              <FilaCantidad etiqueta="Empanadas a elegir (relleno)" valor={form.empanadas} onChange={(v) => cambiarOpciones('empanadas', v)} />
              <Text style={styles.ayuda}>Rellenos especiales con costo adicional: Catira y Pelúa (+$400 arepa / +$200 empanada), Pabellón (+$800 / +$400).</Text>
            </>
          ) : form.categoria === 'arepa' ? (
            <Text style={styles.ayuda}>Las arepas sueltas piden elegir cocción (Asada / Frita).</Text>
          ) : null}
          <Campo etiqueta="Incluye / acompañamientos (separados por coma)">
            <TextInput
              value={form.acompanamientos}
              onChangeText={(v) => cambiar('acompanamientos', v)}
              style={styles.input}
              placeholder="12 tequeños, Salsa de ajo"
              placeholderTextColor={colors.textMuted}
            />
          </Campo>
        </Seccion>

        {!esNuevo && original ? (
          confirmarBorrado ? (
            <View style={styles.borrado}>
              <Text style={styles.borradoTexto}>¿Eliminar "{original.nombre}" del menú? No se puede deshacer. Si solo querés ocultarlo, usá "Desactivado".</Text>
              <View style={styles.dosColumnas}>
                <Button label="Cancelar" variante="contorno" onPress={() => setConfirmarBorrado(false)} style={{ flex: 1 }} />
                <Button label="Eliminar" variante="secundario" onPress={borrar} style={{ flex: 1, backgroundColor: colors.danger }} />
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmarBorrado(true)} style={styles.eliminar}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.eliminarTexto}>Eliminar producto</Text>
            </Pressable>
          )
        ) : null}
      </ScrollView>

      <View style={[styles.barra, { paddingBottom: insets.bottom + spacing.md }]}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!valido ? <Text style={styles.ayuda}>Completá el nombre y el precio para guardar.</Text> : null}
        <Button
          label={guardando ? 'Guardando…' : 'Guardar'}
          onPress={guardar}
          disabled={!valido || guardando}
          icono={guardando ? <ActivityIndicator color={colors.sobreAcento} /> : undefined}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={styles.seccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

function Campo({ etiqueta, children, flex }: { etiqueta: string; children: ReactNode; flex?: boolean }) {
  return (
    <View style={[styles.campo, flex && { flex: 1 }]}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      {children}
    </View>
  );
}

function FilaCantidad({ etiqueta, valor, onChange }: { etiqueta: string; valor: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.switchFila}>
      <Text style={styles.switchTexto}>{etiqueta}</Text>
      <QuantityStepper value={valor} onChange={onChange} min={0} max={8} size="sm" />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.md, gap: spacing.md, width: '100%', maxWidth: 720, alignSelf: 'center' },
  seccion: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  seccionTitulo: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  fotoFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  foto: { width: 96, height: 96, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  fotoVacia: { alignItems: 'center', justifyContent: 'center' },
  campo: { gap: 6 },
  etiqueta: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: 15,
  },
  multilinea: { minHeight: 80, textAlignVertical: 'top' },
  dosColumnas: { flexDirection: 'row', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ayuda: { color: colors.textMuted, fontSize: 12 },
  switchFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  switchTexto: { color: colors.textPrimary, fontSize: 14, flex: 1 },
  eliminar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'center', padding: spacing.md },
  eliminarTexto: { color: colors.danger, fontWeight: '600' },
  borrado: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.danger },
  borradoTexto: { color: colors.textPrimary, fontSize: 14 },
  barra: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  error: { color: colors.danger, textAlign: 'center' },
});
