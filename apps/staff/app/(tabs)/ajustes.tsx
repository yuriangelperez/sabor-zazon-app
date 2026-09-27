import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import type { ConfiguracionLocal } from '@sabor/types';
import { getConfiguracion, mensajeError, pausarRecepcion, suscribirConfiguracion } from '@sabor/api-client';
import { Button, colors, radii, spacing, Text, TextInput } from '@sabor/ui';
import { estaAbierto } from '@sabor/utils';

import { activarAvisos, useAvisosStore } from '../../services/notificaciones';
import { useSesionStore } from '../../stores/useSesionStore';

// RF-13 (cerrar tienda) y cuenta. Los ingredientes agotados están en Menú.
export default function Ajustes() {
  const { perfil, salir } = useSesionStore();
  const avisos = useAvisosStore();
  const [config, setConfig] = useState<ConfiguracionLocal | null>(null);
  const [mensajePausa, setMensajePausa] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setConfig(await getConfiguracion());
    } catch (err) {
      setError(mensajeError(err));
    }
  }, []);

  useEffect(() => {
    void cargar();
    return suscribirConfiguracion(() => void cargar());
  }, [cargar]);

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setError(null);
    try {
      await accion();
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    }
  };

  const enHorario = config ? estaAbierto({ apertura: config.horarioApertura, cierre: config.horarioCierre }) : false;

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Seccion titulo="Recepción de pedidos">
        {config ? (
          <>
            <View style={[styles.estado, config.pausado ? styles.estadoPausado : styles.estadoActivo]}>
              <Text style={styles.estadoTexto}>
                {config.pausado
                  ? 'Pausada: los clientes no pueden hacer pedidos.'
                  : enHorario
                    ? 'Abierto: se están recibiendo pedidos.'
                    : `Fuera de horario (${config.horarioApertura} a ${config.horarioCierre}).`}
              </Text>
            </View>
            <Fila texto="Recibir pedidos">
              <Switch
                value={!config.pausado}
                onValueChange={(recibir) => void ejecutar(() => pausarRecepcion(!recibir, mensajePausa.trim() || undefined))}
                trackColor={{ true: colors.success, false: colors.danger }}
                thumbColor={colors.textPrimary}
              />
            </Fila>
            {!config.pausado ? (
              <TextInput
                value={mensajePausa}
                onChangeText={setMensajePausa}
                placeholder="Mensaje opcional al pausar (ej: Cocina saturada, volvemos en 20 min)"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
            ) : config.mensajePausa ? (
              <Text style={styles.ayuda}>Mensaje a los clientes: “{config.mensajePausa}”</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.ayuda}>Cargando…</Text>
        )}
      </Seccion>

      {Platform.OS !== 'web' ? (
        <Seccion titulo="Avisos de pedidos">
          <View style={[styles.estado, avisos.estado === 'activos' ? styles.estadoActivo : styles.estadoPausado]}>
            <Text style={styles.estadoTexto}>
              {avisos.estado === 'activos'
                ? 'Activados: este celular avisa cada pedido nuevo, aunque la app esté cerrada.'
                : avisos.estado === 'desconocido'
                  ? 'Activando…'
                  : 'Este celular no recibe avisos con la app cerrada.'}
            </Text>
          </View>
          {avisos.detalle ? <Text style={styles.ayuda}>{avisos.detalle}</Text> : null}
          {avisos.estado === 'sin_permiso' ? (
            <Button label="Abrir ajustes del celular" variante="contorno" onPress={() => void Linking.openSettings()} />
          ) : avisos.estado === 'error' ? (
            <Button label="Reintentar" variante="contorno" onPress={() => void activarAvisos()} />
          ) : null}
        </Seccion>
      ) : null}

      <Seccion titulo="Cuenta">
        <Text style={styles.cuenta}>{perfil?.nombre ?? perfil?.email}</Text>
        <Text style={styles.ayuda}>
          {perfil?.email} · {perfil?.rol === 'dueña' ? 'Dueña' : 'Recepción'}
        </Text>
        <Button label="Cerrar sesión" variante="contorno" onPress={() => void salir()} />
      </Seccion>
    </ScrollView>
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

function Fila({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaTexto}>{texto}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  error: { color: colors.danger, textAlign: 'center' },
  seccion: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  seccionTitulo: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  estado: { padding: spacing.sm, borderRadius: radii.sm, borderWidth: 1 },
  estadoActivo: { borderColor: 'rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.08)' },
  estadoPausado: { borderColor: colors.danger, backgroundColor: 'rgba(231,76,60,0.12)' },
  estadoTexto: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  filaTexto: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: 14,
  },
  ayuda: { color: colors.textMuted, fontSize: 12 },
  cuenta: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
});
