import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { create } from 'zustand';
import { mensajeError, quitarDispositivo, registrarDispositivo } from '@sabor/api-client';

// Push de "nuevo pedido" (RNF-02): llega aunque la app esté cerrada o el
// celular bloqueado. Lo manda la base de datos al entrar cada pedido
// (supabase/migrations/0002_notificaciones.sql).

// Mismo id y sonido que usa el aviso en la base (channelId / sound).
export const CANAL_PEDIDOS = 'pedidos';
const CLAVE_TOKEN = 'sabor-push-token';

export type EstadoAvisos = 'desconocido' | 'activos' | 'sin_permiso' | 'no_disponible' | 'error';

export const useAvisosStore = create<{ estado: EstadoAvisos; detalle: string | null }>()(() => ({
  estado: 'desconocido',
  detalle: null,
}));

// Con la app abierta ya suena y aparece el aviso propio (AvisoNuevoPedido),
// así que el push solo queda en la bandeja de notificaciones.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function noDisponible(detalle: string) {
  useAvisosStore.setState({ estado: 'no_disponible', detalle });
}

// Pide permiso, obtiene el token del celular y lo registra en Supabase.
// Se llama al entrar a la app con sesión de recepción.
export async function activarAvisos(): Promise<void> {
  if (Platform.OS === 'web') return noDisponible('En la web no hay notificaciones: usá la app instalada.');
  if (!Device.isDevice) return noDisponible('Las notificaciones solo funcionan en un celular real.');
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return noDisponible('Expo Go no recibe notificaciones: instalá el APK de recepción.');
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_PEDIDOS, {
        name: 'Pedidos nuevos',
        description: 'Avisa cuando entra un pedido.',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'nuevo_pedido.mp3',
        vibrationPattern: [0, 400, 200, 400],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') {
      useAvisosStore.setState({ estado: 'sin_permiso', detalle: 'Activá las notificaciones de la app en los ajustes del celular.' });
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registrarDispositivo(token, Platform.OS);
    await AsyncStorage.setItem(CLAVE_TOKEN, token);
    useAvisosStore.setState({ estado: 'activos', detalle: null });
  } catch (err) {
    useAvisosStore.setState({ estado: 'error', detalle: mensajeError(err, 'No se pudieron activar las notificaciones.') });
  }
}

// Al cerrar sesión (antes de salir, mientras todavía hay sesión), para que
// este celular deje de recibir pedidos.
export async function desactivarAvisos(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(CLAVE_TOKEN);
    if (token) await quitarDispositivo(token);
    await AsyncStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Si falla (ej. sin internet), el aviso le llegaría hasta que otro usuario inicie sesión en este celular.
  }
  useAvisosStore.setState({ estado: 'desconocido', detalle: null });
}
