import type { ConfiguracionLocal } from '@sabor/types';

export interface HorarioLocal {
  apertura: string; // "HH:mm"
  cierre: string; // "HH:mm"
}

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// RF-07: estado Abierto / Cerrado del local. Soporta horarios que cruzan la
// medianoche (ej. 18:00 a 02:00).
export function estaAbierto(horario: HorarioLocal, ahora: Date = new Date()): boolean {
  const actual = ahora.getHours() * 60 + ahora.getMinutes();
  const apertura = aMinutos(horario.apertura);
  const cierre = aMinutos(horario.cierre);

  if (apertura <= cierre) return actual >= apertura && actual < cierre;
  return actual >= apertura || actual < cierre;
}

type EstadoLocal = Pick<ConfiguracionLocal, 'pausado' | 'pausadoHasta' | 'horarioApertura' | 'horarioCierre'>;

// Cierre manual todavía vigente (vence solo en la próxima apertura).
export function pausaVigente(c: Pick<EstadoLocal, 'pausado' | 'pausadoHasta'>, ahora: Date = new Date()): boolean {
  return c.pausado && (!c.pausadoHasta || ahora < new Date(c.pausadoHasta));
}

// ¿Se pueden hacer pedidos ahora? Horario + cierre manual (igual que
// local_abierto() en la base, que es la que decide al crear el pedido).
export function localAbierto(c: EstadoLocal, ahora: Date = new Date()): boolean {
  return !pausaVigente(c, ahora) && estaAbierto({ apertura: c.horarioApertura, cierre: c.horarioCierre }, ahora);
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// "hoy a las 18:00", "mañana a las 10:00", "el lunes a las 10:00".
export function describirMomento(iso: string, ahora: Date = new Date()): string {
  const d = new Date(iso);
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diferencia = Math.round((dia(d) - dia(ahora)) / 86_400_000);
  if (diferencia === 0) return `hoy a las ${hora}`;
  if (diferencia === 1) return `mañana a las ${hora}`;
  return `el ${DIAS[d.getDay()]} a las ${hora}`;
}

// Horarios para elegir en recepción, cada 30 minutos: "00:00" … "23:30".
export const HORAS_DEL_DIA = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
