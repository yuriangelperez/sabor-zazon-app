import { useEffect } from 'react';
import { Platform, Vibration } from 'react-native';
import { create } from 'zustand';
import { useAudioPlayer } from 'expo-audio';
import type { EstadoPedido, Pedido } from '@sabor/types';
import { cambiarEstadoPedido, getPedidosActivos, mensajeError, suscribirPedidos } from '@sabor/api-client';

const sonidoNuevoPedido = require('../assets/sonidos/nuevo_pedido.mp3');

interface PedidosEnVivoStore {
  pedidos: Pedido[];
  cargando: boolean;
  error: string | null;
  conectado: boolean;
  ultimoNuevo: number | null; // número del último pedido que entró (para el aviso)
  cargar: () => Promise<void>;
  cambiarEstado: (id: string, estado: EstadoPedido) => Promise<void>;
  descartarAviso: () => void;
}

export const usePedidosEnVivoStore = create<PedidosEnVivoStore>()((set, get) => ({
  pedidos: [],
  cargando: true,
  error: null,
  conectado: false,
  ultimoNuevo: null,

  cargar: async () => {
    try {
      const pedidos = await getPedidosActivos();
      set({ pedidos, error: null });
    } catch (err) {
      set({ error: mensajeError(err, 'No se pudieron cargar los pedidos.') });
    } finally {
      set({ cargando: false });
    }
  },

  // Cambio optimista: se ve al instante y se revierte si falla.
  cambiarEstado: async (id, estado) => {
    const anteriores = get().pedidos;
    set({ pedidos: anteriores.map((p) => (p.id === id ? { ...p, estado } : p)) });
    try {
      await cambiarEstadoPedido(id, estado);
      await get().cargar();
    } catch (err) {
      set({ pedidos: anteriores, error: mensajeError(err, 'No se pudo actualizar el pedido.') });
    }
  },

  descartarAviso: () => set({ ultimoNuevo: null }),
}));

// Se monta una sola vez (layout de las pestañas): carga los pedidos, escucha
// en tiempo real y suena/vibra con cada pedido nuevo (RF-09 / RF-11).
export function usePedidosEnVivo() {
  const reproductor = useAudioPlayer(sonidoNuevoPedido);

  useEffect(() => {
    const { cargar } = usePedidosEnVivoStore.getState();
    void cargar();

    const desuscribir = suscribirPedidos((evento) => {
      if (evento.tipo === 'nuevo') {
        usePedidosEnVivoStore.setState({ ultimoNuevo: evento.numero });
        try {
          reproductor.seekTo(0);
          reproductor.play();
        } catch {
          // En la web el navegador puede bloquear el sonido hasta que se toque la pantalla.
        }
        if (Platform.OS !== 'web') Vibration.vibrate([0, 400, 200, 400]);
      }
      void usePedidosEnVivoStore.getState().cargar();
    });
    usePedidosEnVivoStore.setState({ conectado: true });

    // Respaldo por si se corta el WebSocket (ej. el celular se bloqueó).
    const respaldo = setInterval(() => void usePedidosEnVivoStore.getState().cargar(), 30_000);

    return () => {
      desuscribir();
      clearInterval(respaldo);
      usePedidosEnVivoStore.setState({ conectado: false });
    };
  }, [reproductor]);
}
