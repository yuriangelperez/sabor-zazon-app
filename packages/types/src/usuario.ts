export type Rol = 'cliente' | 'recepcionista' | 'dueña';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  celular?: string;
  rol: Rol;
  direccionesGuardadas?: { etiqueta: 'Casa' | 'Trabajo' | string; direccion: string }[];
}
