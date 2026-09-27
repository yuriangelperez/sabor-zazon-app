import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Producto } from '@sabor/types';
import { guardarOpcionesProducto, mensajeError } from '@sabor/api-client';
import { Button, colors, radii, spacing, Text, TextInput } from '@sabor/ui';
import {
  aplicarPreciosRelleno,
  formatPrice,
  preciosDeRellenos,
  RELLENOS_COMBO,
  type PiezaCombo,
  type PreciosRelleno,
} from '@sabor/utils';

type Formulario = Record<PiezaCombo, Record<string, string>>;

const PIEZAS: { id: PiezaCombo; titulo: string }[] = [
  { id: 'arepa', titulo: 'En arepas' },
  { id: 'empanada', titulo: 'En empanadas' },
];

const aFormulario = (p: PreciosRelleno): Formulario => ({
  arepa: Object.fromEntries(Object.entries(p.arepa).map(([k, v]) => [k, String(v)])),
  empanada: Object.fromEntries(Object.entries(p.empanada).map(([k, v]) => [k, String(v)])),
});

const aPrecios = (f: Formulario): PreciosRelleno => ({
  arepa: Object.fromEntries(Object.entries(f.arepa).map(([k, v]) => [k, Number(v.replace(/\D/g, '')) || 0])),
  empanada: Object.fromEntries(Object.entries(f.empanada).map(([k, v]) => [k, Number(v.replace(/\D/g, '')) || 0])),
});

// Precio adicional de cada relleno al armar un combo (ej. Pelúa +$400 en
// arepa). Se aplica a todos los combos y a los que se creen después.
export function PreciosRellenosPanel({ productos, onCambio }: { productos: Producto[]; onCambio: () => Promise<void> }) {
  const actuales = useMemo(() => preciosDeRellenos(productos), [productos]);
  const [form, setForm] = useState<Formulario>(() => aFormulario(actuales));
  const [tocado, setTocado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);

  // Si otro dispositivo cambia los precios, se reflejan mientras no haya
  // cambios sin guardar acá.
  useEffect(() => {
    if (!tocado) setForm(aFormulario(actuales));
  }, [actuales, tocado]);

  const cambiar = (pieza: PiezaCombo, clave: string, valor: string) => {
    setTocado(true);
    setAviso(null);
    setForm((f) => ({ ...f, [pieza]: { ...f[pieza], [clave]: valor.replace(/\D/g, '') } }));
  };

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    try {
      const precios = aPrecios(form);
      const cambios = productos
        .map((p) => ({ p, grupos: aplicarPreciosRelleno(p.gruposOpciones, precios) }))
        .filter((c) => c.grupos !== null);
      await Promise.all(cambios.map((c) => guardarOpcionesProducto(c.p.id, c.grupos!)));
      setTocado(false);
      await onCambio();
      setAviso({
        texto:
          cambios.length === 0
            ? 'No había cambios para guardar.'
            : `Listo: se actualizaron ${cambios.length} ${cambios.length === 1 ? 'combo' : 'combos'}.`,
      });
    } catch (err) {
      setAviso({ texto: mensajeError(err, 'No se pudieron guardar los precios.'), error: true });
    } finally {
      setGuardando(false);
    }
  };

  const descartar = () => {
    setTocado(false);
    setAviso(null);
    setForm(aFormulario(actuales));
  };

  return (
    <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
      <Text style={styles.ayuda}>
        Lo que se suma al precio del combo cuando el cliente elige ese relleno. Dejá 0 para que no tenga costo extra. El
        precio de los productos sueltos (ej. Arepa Pelúa) se cambia desde Productos.
      </Text>

      <View style={styles.columnas}>
        {PIEZAS.map((pieza) => (
          <View key={pieza.id} style={styles.tarjeta}>
            <Text style={styles.titulo}>{pieza.titulo}</Text>
            {RELLENOS_COMBO.map((r) => {
              const valor = form[pieza.id][r.clave] ?? '0';
              const cambiado = Number(valor || 0) !== actuales[pieza.id][r.clave];
              return (
                <View key={r.clave} style={styles.fila}>
                  <Text style={styles.nombre}>{r.nombre}</Text>
                  <View style={[styles.campo, cambiado && styles.campoCambiado]}>
                    <Text style={styles.prefijo}>+ $</Text>
                    <TextInput
                      value={valor}
                      onChangeText={(v) => cambiar(pieza.id, r.clave, v)}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      style={styles.input}
                      accessibilityLabel={`Precio adicional ${r.nombre} ${pieza.titulo.toLowerCase()}`}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {aviso ? <Text style={[styles.aviso, aviso.error && { color: colors.danger }]}>{aviso.texto}</Text> : null}

      <View style={styles.acciones}>
        {tocado ? <Button label="Descartar" variante="contorno" onPress={descartar} disabled={guardando} /> : null}
        <Button label={guardando ? 'Guardando…' : 'Guardar precios'} onPress={() => void guardar()} disabled={!tocado || guardando} />
      </View>

      <Text style={styles.ayuda}>
        Ejemplo: con Pelúa en {formatPrice(actuales.arepa.pelua ?? 0)} extra, un combo de 2 arepas Pelúa suma{' '}
        {formatPrice((actuales.arepa.pelua ?? 0) * 2)}.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl, width: '100%', maxWidth: 900, alignSelf: 'center' },
  ayuda: { color: colors.textMuted, fontSize: 13 },
  columnas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tarjeta: {
    flexGrow: 1,
    flexBasis: 280,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  titulo: { color: colors.acento, fontSize: 17, fontWeight: '700', marginBottom: spacing.xs },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  nombre: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
  },
  campoCambiado: { borderColor: colors.acento },
  prefijo: { color: colors.textMuted, fontSize: 14 },
  input: { flex: 1, minHeight: 40, color: colors.textPrimary, fontSize: 15, textAlign: 'right' },
  aviso: { color: colors.success, textAlign: 'center', fontWeight: '600' },
  acciones: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
