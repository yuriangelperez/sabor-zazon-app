// Celular argentino escrito como sea → número para wa.me (54 9 + área + número).
// La app de WhatsApp del celular no lo corrige sola (la web sí): con
// "1122504678" dice que no es un número válido.
//   "11 2250-4678", "011 15 2250-4678", "+54 9 11 2250 4678" → "5491122504678"
//   "0221 15 456-7890" → "5492214567890"
//   "15 2250-4678", "2250-4678" (sin área) → se asume 11, el área de Pilar
// Si no parece un número argentino, devuelve los dígitos tal cual.
export function numeroWhatsApp(celular: string): string {
  let n = celular.replace(/\D/g, '').replace(/^00/, '');
  // Código de país (solo si es largo: "5432-1234" es un número local).
  if (n.length >= 12 && n.startsWith('54')) n = n.slice(2).replace(/^9/, '');
  n = n.replace(/^0/, '');

  // Con el 15 después del código de área (2, 3 o 4 dígitos): sobran 2 dígitos.
  if (n.length === 12) {
    const largoArea = [2, 3, 4].find((largo) => n.slice(largo, largo + 2) === '15');
    if (largoArea) n = n.slice(0, largoArea) + n.slice(largoArea + 2);
  }

  // Sin código de área: el local está en el AMBA (11). No existe el área 15.
  if (n.length === 10 && n.startsWith('15')) n = `11${n.slice(2)}`;
  if (n.length === 8) n = `11${n}`;

  // Área + número siempre suman 10 dígitos en Argentina.
  return n.length === 10 ? `549${n}` : celular.replace(/\D/g, '');
}

export function enlaceWhatsApp(celular: string, mensaje?: string): string {
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${numeroWhatsApp(celular)}${texto}`;
}
