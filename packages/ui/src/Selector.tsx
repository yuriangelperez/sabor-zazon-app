import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { colors, radii, spacing } from './theme';

export interface OpcionSelector {
  id: string;
  label: string;
  detalle?: string; // ej. "+$400"
  deshabilitada?: boolean;
}

interface SelectorProps {
  titulo: string; // encabezado de la lista (ej. "Arepa 1 · Relleno")
  opciones: OpcionSelector[];
  valor: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
}

// Lista desplegable compacta: un campo como un <select> que al tocarlo abre
// la lista de opciones desde abajo. Se ve igual en Android, iOS y web.
export function Selector({ titulo, opciones, valor, onChange, placeholder = 'Elegí' }: SelectorProps) {
  const [abierto, setAbierto] = useState(false);
  const insets = useSafeAreaInsets();
  const elegida = opciones.find((o) => o.id === valor);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${titulo}: ${elegida?.label ?? placeholder}`}
        onPress={() => setAbierto(true)}
        style={[styles.campo, !elegida && styles.campoVacio]}
      >
        <Text style={[styles.valor, !elegida && styles.placeholder]} numberOfLines={1}>
          {elegida ? elegida.label : placeholder}
        </Text>
        {elegida?.detalle ? <Text style={styles.detalleCampo}>{elegida.detalle}</Text> : null}
        <Text style={styles.flecha}>▾</Text>
      </Pressable>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable style={styles.fondo} onPress={() => setAbierto(false)} accessibilityLabel="Cerrar">
          <Pressable style={[styles.hoja, { paddingBottom: insets.bottom + spacing.md }]} onPress={() => {}}>
            <View style={styles.agarre} />
            <Text style={styles.titulo}>{titulo}</Text>
            <FlatList
              data={opciones}
              keyExtractor={(o) => o.id}
              renderItem={({ item }) => {
                const seleccionada = item.id === valor;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: seleccionada, disabled: item.deshabilitada }}
                    disabled={item.deshabilitada}
                    onPress={() => {
                      onChange(item.id);
                      setAbierto(false);
                    }}
                    style={[styles.opcion, seleccionada && styles.opcionSeleccionada]}
                  >
                    <View style={[styles.radio, seleccionada && styles.radioActivo]} />
                    <Text style={[styles.opcionTexto, item.deshabilitada && styles.opcionDeshabilitada]}>
                      {item.label}
                    </Text>
                    <Text style={styles.opcionDetalle}>{item.deshabilitada ? 'Agotado' : item.detalle}</Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  campoVacio: { borderColor: 'rgba(245, 196, 83, 0.45)' },
  valor: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  placeholder: { color: colors.textMuted },
  detalleCampo: { color: colors.acento, fontSize: 12, fontWeight: '600' },
  flecha: { color: colors.textSecondary, fontSize: 14 },

  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  hoja: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '75%',
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
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  opcionSeleccionada: { backgroundColor: 'rgba(245, 196, 83, 0.1)' },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  radioActivo: { borderColor: colors.acento, borderWidth: 6 },
  opcionTexto: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  opcionDeshabilitada: { color: colors.textMuted, textDecorationLine: 'line-through' },
  opcionDetalle: { color: colors.acento, fontSize: 13, fontWeight: '600' },
});
