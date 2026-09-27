import { asegurarConfiguracion, supabase } from './supabaseClient';

// RNF-02: celulares de recepción que reciben un push cuando entra un pedido
// (ver supabase/migrations/0002_notificaciones.sql).
export async function registrarDispositivo(token: string, plataforma: string): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase.rpc('registrar_dispositivo', { p_token: token, p_plataforma: plataforma });
  if (error) throw error;
}

export async function quitarDispositivo(token: string): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase.rpc('quitar_dispositivo', { p_token: token });
  if (error) throw error;
}
