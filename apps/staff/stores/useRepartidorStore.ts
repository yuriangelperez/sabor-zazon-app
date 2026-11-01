import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// WhatsApp del repartidor (solo dígitos, con código de país: 5491112345678).
// Si está cargado, "Avisar al delivery" abre ese chat directo; si no, se elige el contacto.
interface RepartidorState {
  whatsapp: string;
  setWhatsapp: (numero: string) => void;
}

export const useRepartidorStore = create<RepartidorState>()(
  persist(
    (set) => ({ whatsapp: '', setWhatsapp: (numero) => set({ whatsapp: numero.replace(/\D/g, '') }) }),
    { name: 'repartidor', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
