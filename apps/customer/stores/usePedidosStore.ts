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
    }),
    {
      name: 'sabor-pedidos',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
