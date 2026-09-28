import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface PedidoGuardado {
  id: string;
  numero: number;
  codigo: string;
  creadoEn: string;
}

interface PedidosStore {
  pedidos: PedidoGuardado[];
  // Datos del último checkout, para no tipearlos de nuevo la próxima vez.
  nombre: string;
  celular: string;
  guardarPedido: (pedido: PedidoGuardado) => void;
  guardarDatos: (nombre: string, celular: string) => void;
  quitarPedidos: (ids: string[]) => void;
}

// Pedidos hechos desde este dispositivo, para poder volver a su seguimiento.
export const usePedidosStore = create<PedidosStore>()(
  persist(
    (set) => ({
      pedidos: [],
      nombre: '',
      celular: '',
      guardarPedido: (pedido) => set((s) => ({ pedidos: [pedido, ...s.pedidos].slice(0, 20) })),
      guardarDatos: (nombre, celular) => set({ nombre, celular }),
      // Pedidos que ya no existen en la base (ej. borrados por el local).
      quitarPedidos: (ids) => set((s) => ({ pedidos: s.pedidos.filter((p) => !ids.includes(p.id)) })),
    }),
    {
      name: 'sabor-pedidos',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
