import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import type { Ingrediente, Producto } from '@sabor/types';
import { crearIngrediente, marcarIngredienteAgotado, mensajeError } from '@sabor/api-client';
import { Button, colors, radii, spacing, Text, TextInput } from '@sabor/ui';

// RF-12: disponibilidad de ingredientes. Al marcar uno agotado se ocultan
// los productos que lo usan y se deshabilita esa opción en los combos.
export function IngredientesPanel({
  ingredientes,
  productos,
  onCambio,
}: {
  ingredientes: Ingrediente[];
  productos: Producto[];
  onCambio: () => Promise<void>;
}) {
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setError(null);
    try {
      await accion();
      await onCambio();
    } catch (err) {
      setError(mensajeError(err));
    }
  };

  const usos = (id: string) =>
    productos.filter(
      (p) => p.ingredientes?.includes(id) || p.gruposOpciones?.some((g) => g.opciones.some((o) => o.ingredientes?.includes(id)))
    ).length;

  const agotados = ingredientes.filter((i) => i.agotado).length;

  return (
    <ScrollView contentContainerStyle={styles.contenido}>
      <Text style={styles.ayuda}>
        Al marcar un ingrediente como agotado se ocultan los productos que lo usan y se deshabilita esa opción en los combos.
      </Text>
      {agotados > 0 ? (
        <Text style={styles.resumen}>
          {agotados} {agotados === 1 ? 'ingrediente agotado' : 'ingredientes agotados'}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.lista}>
        {ingredientes.map((i) => {
          const n = usos(i.id);
          return (
            <View key={i.id} style={[styles.fila, i.agotado && styles.filaAgotada]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.nombre, i.agotado && styles.tachado]}>{i.nombre}</Text>
                <Text style={styles.detalle}>{n === 1 ? 'Lo usa 1 producto' : `Lo usan ${n} productos`}</Text>
              </View>
              <Text style={[styles.estado, { color: i.agotado ? colors.danger : colors.success }]}>
                {i.agotado ? 'Agotado' : 'Hay'}
              </Text>
              <Switch
                value={!i.agotado}
                onValueChange={(hay) => void ejecutar(() => marcarIngredienteAgotado(i.id, !hay))}
                trackColor={{ true: colors.success, false: colors.danger }}
                thumbColor={colors.textPrimary}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.agregar}>
        <TextInput
          value={nuevo}
          onChangeText={setNuevo}
          placeholder="Nuevo ingrediente"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Button
          label="Agregar"
          variante="contorno"
          disabled={!nuevo.trim()}
          onPress={() =>
            void ejecutar(async () => {
              await crearIngrediente(nuevo);
              setNuevo('');
            })
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  ayuda: { color: colors.textMuted, fontSize: 13 },
  resumen: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  error: { color: colors.danger, textAlign: 'center' },
  lista: { gap: spacing.sm },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  filaAgotada: { borderColor: colors.danger },
  nombre: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  tachado: { color: colors.textMuted, textDecorationLine: 'line-through' },
  detalle: { color: colors.textMuted, fontSize: 12 },
  estado: { fontSize: 13, fontWeight: '700' },
  agregar: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: 14,
  },
});
