/**
 * URL del mapa embebible de OpenStreetMap con un marcador. No necesita clave
 * (Google Maps sí, y sin clave el mapa sale en negro en Expo Go y en el .apk).
 */
export function urlMapaOsm(latitud: number, longitud: number) {
  const delta = 0.004;
  const bbox = [longitud - delta, latitud - delta, longitud + delta, latitud + delta].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitud},${longitud}`;
}
