import type { Session } from '@supabase/supabase-js';
import type { Rol } from '@sabor/types';

import { asegurarConfiguracion, supabase, supabaseConfigurado } from './supabaseClient';

export interface PerfilStaff {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: Rol;
}

// En la base el rol de la dueña se guarda sin ñ ('duena').
function rolDesdeDb(rol: string): Rol {
  return rol === 'duena' ? 'dueña' : (rol as Rol);
}

export function esRolStaff(rol: Rol | undefined): boolean {
  return rol === 'recepcionista' || rol === 'dueña';
}

export async function iniciarSesion(email: string, password: string): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function cerrarSesion(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSesion(): Promise<Session | null> {
  if (!supabaseConfigurado) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getPerfil(userId: string): Promise<PerfilStaff | null> {
  asegurarConfiguracion();
  const { data, error } = await supabase.from('perfiles').select('id, email, nombre, rol').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, rol: rolDesdeDb(data.rol) } as PerfilStaff;
}

export function onCambioSesion(callback: (sesion: Session | null) => void): () => void {
  if (!supabaseConfigurado) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => callback(sesion));
  return () => data.subscription.unsubscribe();
}
