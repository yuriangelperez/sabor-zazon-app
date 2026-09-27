import { create } from 'zustand';
import {
  cerrarSesion,
  esRolStaff,
  getPerfil,
  getSesion,
  iniciarSesion,
  mensajeError,
  onCambioSesion,
  type PerfilStaff,
} from '@sabor/api-client';

import { desactivarAvisos } from '../services/notificaciones';

interface SesionStore {
  perfil: PerfilStaff | null;
  iniciando: boolean; // leyendo la sesión guardada al abrir la app
  error: string | null;
  inicializar: () => () => void;
  entrar: (email: string, password: string) => Promise<void>;
  salir: () => Promise<void>;
}

// RF-14: solo recepción y la dueña pueden usar esta app. Un usuario con otro
// rol inicia sesión pero se lo saca con un mensaje.
async function perfilStaff(userId: string): Promise<PerfilStaff> {
  const perfil = await getPerfil(userId);
  if (!perfil || !esRolStaff(perfil.rol)) {
    await cerrarSesion();
    throw new Error('Tu usuario no tiene acceso a recepción. Pedile a la dueña que te habilite.');
  }
  return perfil;
}

export const useSesionStore = create<SesionStore>()((set) => ({
  perfil: null,
  iniciando: true,
  error: null,

  inicializar: () => {
    getSesion()
      .then(async (sesion) => {
        set({ perfil: sesion ? await perfilStaff(sesion.user.id) : null });
      })
      .catch(() => set({ perfil: null }))
      .finally(() => set({ iniciando: false }));

    // Si la sesión vence o se cierra en otro lado, volver al login.
    return onCambioSesion((sesion) => {
      if (!sesion) set({ perfil: null });
    });
  },

  entrar: async (email, password) => {
    set({ error: null });
    try {
      await iniciarSesion(email, password);
      const sesion = await getSesion();
      if (!sesion) throw new Error('No se pudo iniciar sesión.');
      set({ perfil: await perfilStaff(sesion.user.id) });
    } catch (err) {
      set({ error: mensajeError(err, 'No se pudo iniciar sesión.') });
    }
  },

  salir: async () => {
    await desactivarAvisos();
    await cerrarSesion();
    set({ perfil: null });
  },
}));
