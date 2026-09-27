import type { HorarioLocal } from '@sabor/utils';

// Datos del local tomados de la web anterior (Web-Sabor-Sazon).
// Cuando exista la tabla de configuración en Supabase, esto se lee de ahí.
export const LOCAL = {
  nombre: 'Sabor y Sazón',
  eslogan: 'El auténtico sabor venezolano',
  calle: 'San Ignacio 663',
  localidad: 'Manuel Alberti, Pilar, Buenos Aires, Argentina',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=San+Ignacio+663,+Manuel+Alberti,+Pilar,+Buenos+Aires',
  horario: { apertura: '10:00', cierre: '22:00' } satisfies HorarioLocal,
  diasAtencion: 'Lunes a Domingo',
  whatsapps: [
    { etiqueta: '+54 9 11 2552-3930', numero: '5491125523930' },
    { etiqueta: '+54 9 3757 61-2971', numero: '5493757612971' },
  ],
} as const;

export function whatsappUrl(numero: string, mensaje = '¡Hola! Quiero hacer una consulta.') {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
