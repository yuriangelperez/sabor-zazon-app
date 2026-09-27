import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ItemCarrito, OpcionElegida } from '@sabor/types';
import { Button, colors, fuenteImagen, QuantityStepper, radii, spacing, Text, typography } from '@sabor/ui';
import { formatPrice } from '@sabor/utils';

import { ANCHO_MAXIMO, Contenedor } from '../../components/Contenedor';
import { selectSubtotal, useCarritoStore } from '../../stores/useCarritoStore';

// RF-05: gestión del carrito.
export default function Carrito() {
  const items = useCarritoStore((s) => s.items);
  const subtotal = useCarritoStore(selectSubtotal);
  const insets = useSafeAreaInsets();

  if (items.length === 0) {
    return (
      <View style={styles.vacio}>
        <Ionicons name="cart-outline" size={48} color={colors.textMuted} />
        <Text style={styles.vacioTitulo}>Tu carrito está vacío</Text>
        <Text style={styles.vacioTexto}>¡Agregá tus arepas o combos favoritos!</Text>
        <Button label="Ver menú" onPress={() => router.replace('/menu')} />
      </View>
    );
  }

  return (
    <View style={styles.pantalla}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        renderItem={({ item }) => <FilaCarrito item={item} />}
        contentContainerStyle={styles.lista}
        ListFooterComponent={
          <Pressable onPress={() => router.push('/menu')} style={styles.seguir}>
            <Ionicons name="add-circle-outline" size={20} color={colors.acento} />
            <Text style={styles.seguirTexto}>Agregar más productos</Text>
          </Pressable>
        }
      />

      <View style={[styles.resumen, { paddingBottom: insets.bottom + spacing.md }]}>
        <Contenedor style={styles.resumenContenido}>
          <View style={styles.totalFila}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValor}>{formatPrice(subtotal)}</Text>
          </View>
          <Text style={styles.totalNota}>El envío, cupones y propina se calculan en el siguiente paso.</Text>
          <Button label="Continuar" onPress={() => router.push('/checkout')} />
        </Contenedor>
      </View>
    </View>
  );
}

function FilaCarrito({ item }: { item: ItemCarrito }) {
  const cambiarCantidad = useCarritoStore((s) => s.cambiarCantidad);
  const eliminarItem = useCarritoStore((s) => s.eliminarItem);
  const [abierto, setAbierto] = useState(false);
  const tieneDetalle = item.opcionesElegidas.length > 0 || (item.acompañamientos?.length ?? 0) > 0;

  return (
    <View style={styles.item}>
      <View style={styles.itemFila}>
        <Image source={fuenteImagen(item.imagen)} style={styles.itemImagen} />
        <View style={styles.itemInfo}>
          <Text style={styles.itemNombre}>{item.nombre}</Text>
          <Text style={styles.itemUnitario}>
            {formatPrice(item.precioUnitario)} c/u
          </Text>
          <Text style={styles.itemTotal}>{formatPrice(item.precioUnitario * item.cantidad)}</Text>
        </View>
      </View>

      <View style={styles.itemAcciones}>
        {tieneDetalle ? (
          <Pressable onPress={() => setAbierto((a) => !a)} style={styles.detalleToggle}>
            <Text style={styles.enlace}>{abierto ? 'Ocultar detalle' : 'Ver detalle'}</Text>
            <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={16} color={colors.acento} />
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Eliminar ${item.nombre}`}
          onPress={() => eliminarItem(item.key)}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={20} color={colors.rojo} />
        </Pressable>
        <QuantityStepper value={item.cantidad} onChange={(n) => cambiarCantidad(item.key, n)} min={1} size="sm" />
      </View>

      {abierto ? (
        <View style={styles.detalle}>
          {agruparOpciones(item.opcionesElegidas).map(([grupo, opciones]) => (
            <Text key={grupo} style={styles.detalleTexto}>
              <Text style={styles.detalleGrupo}>{grupo}: </Text>
              {opciones
                .map((o) => `${o.cantidad > 1 ? `${o.cantidad}× ` : ''}${o.nombre}${o.precioAdicional > 0 ? ` (+${formatPrice(o.precioAdicional)})` : ''}`)
                .join(', ')}
            </Text>
          ))}
          {item.acompañamientos?.length ? (
            <Text style={styles.detalleTexto}>
              <Text style={styles.detalleGrupo}>Incluye: </Text>
              {item.acompañamientos.join(', ')}
            </Text>
          ) : null}
          <Pressable onPress={() => router.push(`/producto/${item.productoId}`)}>
            <Text style={styles.enlace}>Ver producto</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function agruparOpciones(opciones: OpcionElegida[]): [string, OpcionElegida[]][] {
  const grupos = new Map<string, OpcionElegida[]>();
  for (const o of opciones) {
    grupos.set(o.grupoNombre, [...(grupos.get(o.grupoNombre) ?? []), o]);
  }
  return [...grupos.entries()];
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  lista: { width: '100%', maxWidth: ANCHO_MAXIMO, alignSelf: 'center', padding: spacing.md, gap: spacing.md, paddingBottom: 200 },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  vacioTitulo: { ...typography.h2, color: colors.textPrimary },
  vacioTexto: { color: colors.textSecondary, marginBottom: spacing.sm },

  item: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemFila: { flexDirection: 'row', gap: spacing.md },
  itemImagen: { width: 72, height: 72, borderRadius: radii.sm },
  itemInfo: { flex: 1, gap: 2 },
  itemNombre: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  itemUnitario: { color: colors.textMuted, fontSize: 13 },
  itemTotal: { color: colors.acento, fontSize: 17, fontWeight: '800' },
  itemAcciones: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detalleToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  enlace: { color: colors.acento, fontWeight: '700' },
  detalle: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 6 },
  detalleTexto: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  detalleGrupo: { color: colors.textPrimary, fontWeight: '700' },

  seguir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md },
  seguirTexto: { color: colors.acento, fontWeight: '700' },

  resumen: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  resumenContenido: { gap: spacing.sm },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  totalValor: { color: colors.acento, fontSize: 22, fontWeight: '800' },
  totalNota: { color: colors.textMuted, fontSize: 12 },
});
