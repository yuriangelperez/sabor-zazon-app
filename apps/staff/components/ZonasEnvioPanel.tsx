import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import type { ZonaEnvio } from '@sabor/types';
import { actualizarZonaEnvio, crearZonaEnvio, getZonasEnvioAdmin, mensajeError } from '@sabor/api-client';
import { Button, colors, radii, spacing, Text, TextInput } from '@sabor/ui';

const soloNumeros = (v: string) => v.replace(/\D/g, '');

// Zonas de delivery y su costo. Un cambio vale para los pedidos que entren
// desde ese momento (el total lo calcula la base de datos).
export function ZonasEnvioPanel() {
  const [zonas, setZonas] = useState<ZonaEnvio[]>([]);
  const [costos, setCostos] = useState<Record<string, string>>({});
  const [nuevaNombre, setNuevaNombre] = useState('');
  const [nuevaCosto, setNuevaCosto] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const z = await getZonasEnvioAdmin();
      setZonas(z);
      setCostos(Object.fromEntries(z.map((x) => [x.id, String(x.costo)])));
    } catch (err) {
      setAviso({ texto: mensajeError(err, 'No se pudieron cargar las zonas.'), error: true });
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const ejecutar = async (clave: string, accion: () => Promise<void>, ok: string) => {
    setGuardando(clave);
    setAviso(null);
    try {
      await accion();
      await cargar();
      setAviso({ texto: ok });
    } catch (err) {
      setAviso({ texto: mensajeError(err, 'No se pudo guardar.'), error: true });
    } finally {
      setGuardando(null);
    }
  };

  const costoNuevo = Number(nuevaCosto || NaN);

  return (
    <View style={styles.contenedor}>
      <Text style={styles.ayuda}>
        El costo nuevo se aplica a los pedidos que entren desde que lo guardás. Desactivá una zona para dejar de hacer envíos ahí.
      </Text>

      {zonas.map((z) => {
        const valor = costos[z.id] ?? '';
        const cambiado = valor !== '' && Number(valor) !== z.costo;
        return (
          <View key={z.id} style={[styles.fila, !z.activa && styles.filaInactiva]}>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Text style={[styles.nombre, !z.activa && styles.tachado]}>{z.nombre}</Text>
              <Text style={styles.detalle}>{z.activa ? 'Activa' : 'Sin envíos'}</Text>
            </View>
            <View style={[styles.campo, cambiado && styles.campoCambiado]}>
              <Text style={styles.prefijo}>$</Text>
              <TextInput
                value={valor}
                onChangeText={(v) => setCostos((c) => ({ ...c, [z.id]: soloNumeros(v) }))}
                keyboardType="number-pad"
                selectTextOnFocus
                style={styles.input}
                accessibilityLabel={`Costo de envío a ${z.nombre}`}
              />
            </View>
            {cambiado ? (
              <Button
                label={guardando === z.id ? '…' : 'Guardar'}
                disabled={guardando != null}
                onPress={() =>
                  void ejecutar(z.id, () => actualizarZonaEnvio(z.id, { costo: Number(valor) }), `Envío a ${z.nombre} actualizado.`)
                }
                style={styles.boton}
              />
            ) : null}
            <Switch
              value={z.activa}
              disabled={guardando != null}
              onValueChange={(activa) =>
                void ejecutar(
                  z.id,
                  () => actualizarZonaEnvio(z.id, { activa }),
                  activa ? `${z.nombre} vuelve a tener envíos.` : `${z.nombre} ya no aparece en el checkout.`
                )
              }
              trackColor={{ true: colors.success, false: colors.surfaceAlt }}
              thumbColor={colors.textPrimary}
              accessibilityLabel={`Envíos a ${z.nombre}`}
            />
          </View>
        );
      })}

      {aviso ? <Text style={[styles.aviso, aviso.error && { color: colors.danger }]}>{aviso.texto}</Text> : null}

      <View style={styles.agregar}>
        <TextInput
          value={nuevaNombre}
          onChangeText={setNuevaNombre}
          placeholder="Nueva zona (ej: Pilar)"
          placeholderTextColor={colors.textMuted}
          style={[styles.inputSuelto, { flex: 1, minWidth: 140 }]}
        />
        <View style={styles.campo}>
          <Text style={styles.prefijo}>$</Text>
          <TextInput
            value={nuevaCosto}
            onChangeText={(v) => setNuevaCosto(soloNumeros(v))}
            placeholder="Costo"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>
        <Button
          label="Agregar"
          variante="contorno"
          disabled={!nuevaNombre.trim() || Number.isNaN(costoNuevo) || guardando != null}
          onPress={() =>
            void ejecutar(
              'nueva',
              async () => {
                await crearZonaEnvio(nuevaNombre, costoNuevo);
                setNuevaNombre('');
                setNuevaCosto('');
              },
              `Zona ${nuevaNombre.trim()} agregada.`
            )
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: spacing.sm },
  ayuda: { color: colors.textMuted, fontSize: 12 },
  fila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  filaInactiva: { opacity: 0.6 },
  nombre: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  tachado: { textDecorationLine: 'line-through' },
  detalle: { color: colors.textMuted, fontSize: 12 },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 110,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
  },
  campoCambiado: { borderColor: colors.acento },
  prefijo: { color: colors.textMuted, fontSize: 14 },
  input: { flex: 1, minHeight: 40, color: colors.textPrimary, fontSize: 15, textAlign: 'right' },
  inputSuelto: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: 14,
  },
  boton: { paddingHorizontal: spacing.md, paddingVertical: 8 },
  aviso: { color: colors.success, fontWeight: '600', textAlign: 'center' },
  agregar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
});
