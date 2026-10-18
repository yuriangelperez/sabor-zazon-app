import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import type { ConfiguracionLocal, TarifaEnvio } from '@sabor/types';
import { guardarTarifaEnvio, mensajeError } from '@sabor/api-client';
import { Button, colors, radii, spacing, Text, TextInput } from '@sabor/ui';
import { formatPrice } from '@sabor/utils';

const soloNumeros = (v: string) => v.replace(/\D/g, '');
// "6,5" → "6.5", con un decimal como mucho.
const soloDecimal = (v: string) => v.replace(',', '.').replace(/[^\d.]/g, '').replace(/^(\d*\.?\d?).*$/, '$1');

// La misma cuenta que saborsazon.costo_envio (0005_envio_por_km.sql).
function costoEnvio(base: number, porKm: number, km: number): number {
  return Math.ceil((base + porKm * km) / 100) * 100;
}

// Tarifa del envío por km. Un cambio vale para los pedidos que entren desde
// ese momento (el total lo calcula la base de datos).
export function EnvioPanel({ config, onGuardado }: { config: ConfiguracionLocal; onGuardado: () => Promise<void> }) {
  const [campos, setCampos] = useState<{ base: string; porKm: string; kmMaximo: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);

  const base = campos?.base ?? String(config.envioBase);
  const porKm = campos?.porKm ?? String(config.envioPorKm);
  const kmMaximo = campos?.kmMaximo ?? String(config.envioKmMaximo);
  const cambiar = (cambio: Partial<{ base: string; porKm: string; kmMaximo: string }>) =>
    setCampos({ base, porKm, kmMaximo, ...cambio });

  const tarifa: TarifaEnvio = {
    deliveryActivo: config.deliveryActivo,
    envioBase: Number(base),
    envioPorKm: Number(porKm),
    envioKmMaximo: Number(kmMaximo),
  };
  const valida = base !== '' && porKm !== '' && tarifa.envioKmMaximo > 0 && tarifa.envioKmMaximo < 1000;
  const cambiada =
    tarifa.envioBase !== config.envioBase ||
    tarifa.envioPorKm !== config.envioPorKm ||
    tarifa.envioKmMaximo !== config.envioKmMaximo;

  // `soloSwitch`: prende o apaga el delivery con la tarifa guardada, sin
  // tocar lo que se esté editando en los campos.
  const guardar = async (nueva: TarifaEnvio, ok: string, soloSwitch = false) => {
    setGuardando(true);
    setAviso(null);
    try {
      await guardarTarifaEnvio(nueva);
      await onGuardado();
      if (!soloSwitch) setCampos(null);
      setAviso({ texto: ok });
    } catch (err) {
      setAviso({ texto: mensajeError(err, 'No se pudo guardar.'), error: true });
    } finally {
      setGuardando(false);
    }
  };

  const ejemplos = valida
    ? [1, 3, tarifa.envioKmMaximo]
        .filter((km, i, todos) => km <= tarifa.envioKmMaximo && todos.indexOf(km) === i)
        .map((km) => `${String(km).replace('.', ',')} km: ${formatPrice(costoEnvio(tarifa.envioBase, tarifa.envioPorKm, km))}`)
        .join(' · ')
    : null;

  return (
    <View style={styles.contenedor}>
      <View style={styles.fila}>
        <Text style={styles.filaTexto}>Hacer delivery</Text>
        <Switch
          value={config.deliveryActivo}
          disabled={guardando}
          onValueChange={(deliveryActivo) =>
            void guardar(
              {
                deliveryActivo,
                envioBase: config.envioBase,
                envioPorKm: config.envioPorKm,
                envioKmMaximo: config.envioKmMaximo,
              },
              deliveryActivo ? 'El delivery vuelve a aparecer en el checkout.' : 'Sin delivery: los clientes solo pueden retirar.',
              true
            )
          }
          trackColor={{ true: colors.success, false: colors.surfaceAlt }}
          thumbColor={colors.textPrimary}
          accessibilityLabel="Hacer delivery"
        />
      </View>

      <Text style={styles.ayuda}>
        El cliente escribe su dirección y se calcula la distancia por calle desde el local. Costo = base + precio por km
        (redondeado a $100). Más lejos que el máximo no se hace delivery.
      </Text>

      <View style={styles.campos}>
        <Campo etiqueta="Base" prefijo="$" valor={base} onChange={(v) => cambiar({ base: soloNumeros(v) })} />
        <Campo etiqueta="Por km" prefijo="$" valor={porKm} onChange={(v) => cambiar({ porKm: soloNumeros(v) })} />
        <Campo
          etiqueta="Hasta"
          sufijo="km"
          valor={kmMaximo}
          onChange={(v) => cambiar({ kmMaximo: soloDecimal(v) })}
          teclado="decimal-pad"
        />
      </View>

      {ejemplos ? <Text style={styles.ayuda}>{ejemplos}</Text> : <Text style={[styles.ayuda, { color: colors.danger }]}>Completá los tres valores.</Text>}

      {cambiada ? (
        <View style={styles.acciones}>
          <Button label="Descartar" variante="contorno" disabled={guardando} onPress={() => setCampos(null)} />
          <Button
            label={guardando ? '…' : 'Guardar tarifa'}
            disabled={!valida || guardando}
            onPress={() => void guardar(tarifa, 'Tarifa de envío actualizada.')}
          />
        </View>
      ) : null}

      {aviso ? <Text style={[styles.aviso, aviso.error && { color: colors.danger }]}>{aviso.texto}</Text> : null}
    </View>
  );
}

function Campo({
  etiqueta,
  prefijo,
  sufijo,
  valor,
  onChange,
  teclado = 'number-pad',
}: {
  etiqueta: string;
  prefijo?: string;
  sufijo?: string;
  valor: string;
  onChange: (v: string) => void;
  teclado?: 'number-pad' | 'decimal-pad';
}) {
  return (
    <View style={styles.campoBloque}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <View style={styles.campo}>
        {prefijo ? <Text style={styles.prefijo}>{prefijo}</Text> : null}
        <TextInput
          value={valor}
          onChangeText={onChange}
          keyboardType={teclado}
          selectTextOnFocus
          style={styles.input}
          accessibilityLabel={`Envío: ${etiqueta}`}
        />
        {sufijo ? <Text style={styles.prefijo}>{sufijo}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: spacing.sm },
  ayuda: { color: colors.textMuted, fontSize: 12 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  filaTexto: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  campos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  campoBloque: { flexGrow: 1, flexBasis: 100, gap: 6 },
  etiqueta: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
  },
  prefijo: { color: colors.textMuted, fontSize: 14, flexShrink: 0 },
  input: { flex: 1, minHeight: 40, color: colors.textPrimary, fontSize: 15, textAlign: 'right' },
  acciones: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  aviso: { color: colors.success, fontWeight: '600', textAlign: 'center' },
});
