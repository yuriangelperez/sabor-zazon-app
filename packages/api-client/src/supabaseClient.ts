import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Cada app (customer, staff, owner) define en su .env
// EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY, pero todas
// consumen este mismo cliente para evitar lógica duplicada.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigurado = Boolean(supabaseUrl && supabaseAnonKey);

// Todas las tablas y funciones del proyecto viven en este esquema (ver
// supabase/migrations/0001_esquema.sql). Tiene que estar en
// Project Settings → Data API → "Exposed schemas".
export const ESQUEMA = 'saborsazon';

if (!supabaseConfigurado) {
  // eslint-disable-next-line no-console
  console.warn(
    '[@sabor/api-client] Falta EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY en el .env de la app.'
  );
}

// createClient falla con una URL vacía; con la URL de relleno la app arranca
// igual y cada consulta devuelve el error de configuración de abajo.
export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseAnonKey || 'sin-configurar', {
  db: { schema: ESQUEMA },
  auth: {
    storage: AsyncStorage, // la sesión de staff sobrevive a cerrar la app
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

export class ErrorConfiguracion extends Error {
  constructor() {
    super('Supabase no está configurado: completá EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en el .env.');
  }
}

export function asegurarConfiguracion() {
  if (!supabaseConfigurado) throw new ErrorConfiguracion();
}

// Convierte los errores de Supabase en un mensaje para mostrar. Los errores
// de negocio de crear_pedido ya vienen en castellano (ej. "El local no está
// recibiendo pedidos en este momento.").
export function mensajeError(error: unknown, porDefecto = 'Ocurrió un error. Probá de nuevo.'): string {
  if (error instanceof ErrorConfiguracion) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const mensaje = error.message;
    if (/Failed to fetch|Network request failed|NetworkError/i.test(mensaje)) {
      return 'No hay conexión con el servidor. Revisá tu internet.';
    }
    if (/Invalid login credentials/i.test(mensaje)) return 'Email o contraseña incorrectos.';
    if (/Invalid schema|schema must be one of/i.test(mensaje)) {
      return `Falta exponer el esquema "${ESQUEMA}" en Supabase (Project Settings → Data API → Exposed schemas).`;
    }
    return mensaje;
  }
  return porDefecto;
}
