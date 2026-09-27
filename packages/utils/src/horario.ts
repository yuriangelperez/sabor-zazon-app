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
