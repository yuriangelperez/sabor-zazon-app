import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import type { ConfiguracionLocal } from '@sabor/types';
import { getConfiguracion, guardarHorario, mensajeError, pausarRecepcion, suscribirConfiguracion } from '@sabor/api-client';
import { Button, colors, radii, Selector, spacing, Text, TextInput } from '@sabor/ui';
import { describirMomento, estaAbierto, HORAS_DEL_DIA, pausaVigente } from '@sabor/utils';

import { ZonasEnvioPanel } from '../../components/ZonasEnvioPanel';
import { activarAvisos, useAvisosStore } from '../../services/notificaciones';
import { useSesionStore } from '../../stores/useSesionStore';

// RF-13 (cerrar tienda), zonas y costos de envío, avisos y cuenta. Los ingredientes agotados están en Menú.
export default function Ajustes() {
  const { perfil, salir } = useSesionStore();
  const avisos = useAvisosStore();
  const [config, setConfig] = useState<ConfiguracionLocal | null>(null);
  const [mensajePausa, setMensajePausa] = useState('');
  const [horario, setHorario] = useState<{ apertura: string; cierre: string } | null>(null);
  const [, setTic] = useState(0);
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
    const desuscribir = suscribirConfiguracion(() => void cargar());
    // Recalcula cada minuto: el local abre y cierra solo con el horario.
    const intervalo = setInterval(() => setTic((t) => t + 1), 60_000);
    return () => {
      desuscribir();
      clearInterval(intervalo);
    };
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
  const cerradoAMano = config ? pausaVigente(config) : false;
  const apertura = horario?.apertura ?? config?.horarioApertura ?? '';
  const cierre = horario?.cierre ?? config?.horarioCierre ?? '';
  const horarioCambiado = config != null && (apertura !== config.horarioApertura || cierre !== config.horarioCierre);
  const opcionesHora = HORAS_DEL_DIA.map((h) => ({ id: h, label: `${h} hs` }));

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenido}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Seccion titulo="Recepción de pedidos">
        {config ? (
          <>
            <View style={[styles.estado, cerradoAMano || !enHorario ? styles.estadoPausado : styles.estadoActivo]}>
              <Text style={styles.estadoTexto}>
                {cerradoAMano
                  ? `Cerrado a mano: los clientes no pueden pedir. Se abre solo ${
                      config.pausadoHasta ? describirMomento(config.pausadoHasta) : 'cuando lo vuelvas a activar'
                    }.`
                  : enHorario
                    ? `Abierto: se están recibiendo pedidos. Cierra solo a las ${config.horarioCierre}.`
                    : `Cerrado por horario. Abre solo a las ${config.horarioApertura}.`}
              </Text>
            </View>
            <Fila texto="Recibir pedidos">
              <Switch
                value={!cerradoAMano}
                onValueChange={(recibir) => void ejecutar(() => pausarRecepcion(!recibir, mensajePausa.trim() || undefined))}
                trackColor={{ true: colors.success, false: colors.danger }}
                thumbColor={colors.textPrimary}
              />
            </Fila>
            <Text style={styles.ayuda}>
              {cerradoAMano
                ? 'Activalo para volver a recibir pedidos ahora.'
                : 'Si lo desactivás, el local queda cerrado hasta la próxima apertura del horario.'}
            </Text>
            {!cerradoAMano ? (
              <TextInput
                value={mensajePausa}
                onChangeText={setMensajePausa}
                placeholder="Mensaje opcional al cerrar (ej: Cocina saturada)"
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

      <Seccion titulo="Horario de atención">
        {config ? (
          <>
            <Text style={styles.ayuda}>
              Todos los días. El local abre y cierra solo en este horario (puede cruzar la medianoche, ej. 18:00 a 02:00).
            </Text>
            <View style={styles.horario}>
              <View style={styles.hora}>
                <Text style={styles.etiqueta}>Abre</Text>
                <Selector titulo="Abre a las" valor={apertura} opciones={opcionesHora} onChange={(h) => setHorario({ apertura: h, cierre })} />
              </View>
              <View style={styles.hora}>
                <Text style={styles.etiqueta}>Cierra</Text>
                <Selector titulo="Cierra a las" valor={cierre} opciones={opcionesHora} onChange={(h) => setHorario({ apertura, cierre: h })} />
              </View>
            </View>
            {apertura === cierre ? <Text style={styles.error}>La hora de apertura y la de cierre tienen que ser distintas.</Text> : null}
            {horarioCambiado ? (
              <View style={styles.acciones}>
                <Button label="Descartar" variante="contorno" onPress={() => setHorario(null)} />
                <Button
                  label="Guardar horario"
                  disabled={apertura === cierre}
                  onPress={() =>
                    void ejecutar(async () => {
                      await guardarHorario(apertura, cierre);
                      setHorario(null);
                    })
                  }
                />
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.ayuda}>Cargando…</Text>
        )}
      </Seccion>

      <Seccion titulo="Envíos">
        <ZonasEnvioPanel />
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
  horario: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  hora: { flexGrow: 1, flexBasis: 140, gap: 6 },
  etiqueta: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  acciones: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  cuenta: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
});
