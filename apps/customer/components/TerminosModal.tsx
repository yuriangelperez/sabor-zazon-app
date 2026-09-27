import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, colors, radii, spacing, Text } from '@sabor/ui';

import { TERMINOS, TERMINOS_ACTUALIZADOS } from '../constants/terminos';

// Hoja con los términos y condiciones. "Acepto" los marca como aceptados.
export function TerminosModal({
  visible,
  onCerrar,
  onAceptar,
}: {
  visible: boolean;
  onCerrar: () => void;
  onAceptar: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={styles.fondo} onPress={onCerrar} accessibilityLabel="Cerrar">
        <Pressable style={[styles.hoja, { paddingBottom: insets.bottom + spacing.md }]} onPress={() => {}}>
          <View style={styles.encabezado}>
            <Text style={styles.titulo}>Términos y condiciones</Text>
            <Pressable onPress={onCerrar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.contenido}>
            {TERMINOS.map((t) => (
              <View key={t.titulo} style={styles.seccion}>
                <Text style={styles.subtitulo}>{t.titulo}</Text>
                <Text style={styles.texto}>{t.texto}</Text>
              </View>
            ))}
            <Text style={styles.fecha}>Última actualización: {TERMINOS_ACTUALIZADOS}</Text>
          </ScrollView>
          <Button label="Acepto los términos" onPress={onAceptar} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  hoja: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '85%',
    alignSelf: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 3,
    borderTopColor: colors.acento,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { color: colors.textPrimary, fontSize: 19, fontWeight: '700' },
  contenido: { gap: spacing.md, paddingBottom: spacing.sm },
  seccion: { gap: 4 },
  subtitulo: { color: colors.acento, fontSize: 15, fontWeight: '600' },
  texto: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  fecha: { color: colors.textMuted, fontSize: 12 },
});
