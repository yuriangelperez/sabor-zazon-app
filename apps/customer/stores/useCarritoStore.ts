import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ItemCarrito, OpcionElegida, Producto } from '@sabor/types';
import { precioUnitario } from '@sabor/utils';

interface AgregarPayload {
  producto: Producto;
  cantidad: number;
  opciones: OpcionElegida[];
}

interface CarritoStore {
  items: ItemCarrito[];
  agregarItem: (payload: AgregarPayload) => void;
  cambiarCantidad: (key: string, cantidad: number) => void;
  eliminarItem: (key: string) => void;
  vaciar: () => void;
}

// El mismo producto con distintas opciones (ej. arepa asada vs. frita) va en
// ítems separados; con las mismas opciones se suma la cantidad.
function makeKey(productoId: string, opciones: OpcionElegida[]) {
  const firma = opciones
    .filter((o) => o.cantidad > 0)
    .map((o) => `${o.grupoId}:${o.opcionId}:${o.cantidad}`)
    .sort()
    .join('|');
  return `${productoId}::${firma}`;
}

export const useCarritoStore = create<CarritoStore>()(
  persist(
    (set) => ({
      items: [],

      agregarItem: ({ producto, cantidad, opciones }) => {
        if (cantidad <= 0) return;
        const opcionesElegidas = opciones.filter((o) => o.cantidad > 0);
        const key = makeKey(producto.id, opcionesElegidas);

        set((state) => {
          const existente = state.items.find((i) => i.key === key);
          if (existente) {
            return {
              items: state.items.map((i) =>
                i.key === key ? { ...i, cantidad: i.cantidad + cantidad } : i
              ),
            };
          }

          const nuevo: ItemCarrito = {
            key,
            productoId: producto.id,
            nombre: producto.nombre,
            imagen: producto.imagen,
            precioUnitario: precioUnitario(producto, opcionesElegidas),
            cantidad,
            opcionesElegidas,
            acompañamientos: producto.acompañamientos,
          };
          return { items: [...state.items, nuevo] };
        });
      },

      cambiarCantidad: (key, cantidad) => {
        set((state) => ({
          items: state.items
            .map((i) => (i.key === key ? { ...i, cantidad } : i))
            .filter((i) => i.cantidad > 0),
        }));
      },

      eliminarItem: (key) => {
        set((state) => ({ items: state.items.filter((i) => i.key !== key) }));
      },

      vaciar: () => set({ items: [] }),
    }),
    {
      name: 'sabor-carrito',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);

export const selectCantidadTotal = (state: CarritoStore) =>
  state.items.reduce((acc, i) => acc + i.cantidad, 0);

export const selectSubtotal = (state: CarritoStore) =>
  state.items.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0);
