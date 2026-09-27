import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Producto } from '@sabor/types';
import { colors, fuenteImagen, QuantityStepper, radii, spacing, Text } from '@sabor/ui';
import { formatPrice, opcionesPorDefecto, precioConDescuento } from '@sabor/utils';

import { useCarritoStore } from '../stores/useCarritoStore';

interface ProductCardProps {
  producto: Producto;
}

// Tarjeta del menú con agregado rápido "-3+ → Agregar" (RF-03).
// Los combos no se agregan desde acá: llevan al detalle para elegir (RF-04).
export function ProductCard({ producto }: ProductCardProps) {
  const agregarItem = useCarritoStore((s) => s.agregarItem);
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);

  useEffect(() => {
    if (!agregado) return;
    const t = setTimeout(() => setAgregado(false), 1400);
    return () => clearTimeout(t);
  }, [agregado]);

  const disponible = !producto.agotado;
  const precioFinal = precioConDescuento(producto);
  const tieneDescuento = (producto.descuentoPorcentaje ?? 0) > 0;

  const verDetalle = () => router.push(`/producto/${producto.id}`);

  const onAgregar = () => {
    if (producto.esCombo) {
      verDetalle();
      return;
    }
    agregarItem({ producto, cantidad, opciones: opcionesPorDefecto(producto) });
    setCantidad(1);
    setAgregado(true);
  };

  return (
    <Pressable
      accessibilityLabel={`Ver ${producto.nombre}`}
      onPress={verDetalle}
      style={[styles.card, !disponible && styles.cardAgotada]}
    >
      <Image source={fuenteImagen(producto.imagen)} style={styles.imagen} />

      <View style={styles.info}>
        <Text style={styles.nombre} numberOfLines={2}>
          {producto.nombre}
        </Text>
        <Text style={styles.descripcion} numberOfLines={2}>
          {producto.descripcion}
        </Text>

        <View style={styles.precios}>
          <Text style={styles.precio}>{formatPrice(precioFinal)}</Text>
          {tieneDescuento ? <Text style={styles.precioOriginal}>{formatPrice(producto.precio)}</Text> : null}
        </View>

        <View style={styles.acciones}>
          {!producto.esCombo ? (
            <QuantityStepper value={cantidad} onChange={setCantidad} min={1} size="sm" disabled={!disponible} />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={producto.esCombo ? `Armar ${producto.nombre}` : `Agregar ${producto.nombre}`}
            disabled={!disponible}
            onPress={onAgregar}
            style={[styles.boton, agregado && styles.botonAgregado, !disponible && styles.botonDeshabilitado]}
          >
            {agregado ? <Ionicons name="checkmark" size={16} color={colors.sobreAcento} /> : null}
            <Text style={styles.botonTexto}>
              {!disponible ? 'Agotado' : agregado ? 'Agregado' : producto.esCombo ? 'Armar combo' : 'Agregar'}
            </Text>
          </Pressable>
        </View>
      </View>

      {tieneDescuento ? (
        <View style={styles.badge}>
          <Text style={styles.badgeTexto}>-{producto.descuentoPorcentaje}%</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardAgotada: { opacity: 0.55 },
  imagen: { width: 110, height: 110, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt },
  info: { flex: 1, justifyContent: 'space-between', gap: 4 },
  nombre: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  descripcion: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  precios: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  precio: { color: colors.acento, fontSize: 17, fontWeight: '800' },
  precioOriginal: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'line-through' },
  acciones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.acento,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  botonAgregado: { backgroundColor: colors.success },
  botonDeshabilitado: { backgroundColor: colors.textMuted },
  botonTexto: { color: colors.sobreAcento, fontWeight: '700', fontSize: 14 },
  badge: {
    position: 'absolute',
    top: spacing.sm + 6,
    left: spacing.sm + 6,
    backgroundColor: colors.rojo,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  badgeTexto: { color: colors.textPrimary, fontSize: 12, fontWeight: '800' },
});
