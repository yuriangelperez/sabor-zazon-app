// POST { direccion, soloUbicar: true } → { ubicacion | null }: dónde abrir el
// mapa del checkout (cualquier coincidencia, aunque no sirva para cobrar).
// POST { direccion, ubicacion? } → { id, direccion, distanciaKm, costo, ubicacion }
// `ubicacion` ({ lat, lng }): el pin que el cliente marcó en el mapa del
// checkout; se mide desde ahí sin buscar el texto.
// Busca la dirección en TomTom (conoce calles y alturas de la zona que
// OpenStreetMap no tiene) y, si no hay clave o no la encuentra, en
// OpenStreetMap (Nominatim, y Photon si Nominatim falla: suele bloquear
// servidores en la nube). Mide la distancia por calle desde el local (rutas
// de TomTom, si no OSRM) y la guarda en cotizaciones_envio. El checkout manda
// el `id` al crear el pedido: crear_pedido lee la distancia de la base y
// recalcula el costo, así que el cliente no puede mandar una distancia
// inventada.
//
// Todos tienen uso gratis limitado (TomTom: un cupo mensual; Nominatim: 1
// consulta por segundo). Por eso cada dirección medida se reusa 30 días.
// Secretos (Supabase → Edge Functions → Secrets):
//   TOMTOM_API_KEY  (recomendado) clave de developer.tomtom.com
//   CONTACTO_OSM    (opcional) mail de contacto para el User-Agent de OSM
// Deploy: npx supabase functions deploy cotizar-envio --no-verify-jwt

import { cors, db, respuesta } from '../_shared/comun.ts';

// Una dirección ya medida se reusa sin volver a consultar.
const DIAS_CACHE = 30;
const TOMTOM_KEY = Deno.env.get('TOMTOM_API_KEY');
// Si no hay ruta, la distancia por calle se estima como la línea recta
// por este factor (lo típico en ciudad).
const FACTOR_CALLES = 1.3;

const USER_AGENT = `SaborYSazon/1.0 (${Deno.env.get('CONTACTO_OSM') ?? 'delivery'})`;

// Error para mostrarle al cliente tal cual.
class ErrorVisible extends Error {
  constructor(mensaje: string, readonly status = 422) {
    super(mensaje);
  }
}

interface Punto {
  lat: number;
  lng: number;
}

interface Configuracion {
  direccion_local: string;
  delivery_activo: boolean;
  envio_km_maximo: number | string;
  local_lat: number | null;
  local_lng: number | null;
}

// Dirección encontrada, venga de Nominatim o de Photon.
interface Encontrada {
  nombre: string; // la calle o el lugar, sin localidad (para compararlo con lo escrito)
  localidades?: string[]; // barrio, localidad y partido (solo TomTom)
  tipo?: string; // tipo de resultado de TomTom (Point Address, Street…)
  numero?: string; // altura que encontró TomTom
  direccion: string;
  punto: Punto;
  preciso: boolean; // false: solo una localidad o ciudad, no sirve para cobrar por km
}

// "  Irigoyen  1234, PILAR " → "irigoyen 1234, pilar"
function normalizar(direccion: string): string {
  return direccion.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Alrededor del local: "Irigoyen" hay en muchas ciudades y más lejos que el
// máximo no se entrega igual.
function caja(cerca: Punto, radioKm: number) {
  const dLat = radioKm / 111;
  const dLng = radioKm / (111 * Math.cos((cerca.lat * Math.PI) / 180));
  return { oeste: cerca.lng - dLng, sur: cerca.lat - dLat, este: cerca.lng + dLng, norte: cerca.lat + dLat };
}

// TomTom Search (geocode). Tipos: Point Address (la casa), Address Range
// (altura interpolada), Street, Cross Street (esquina), POI, Geography
// (una localidad entera: no sirve para cobrar).
async function buscarTomTom(direccion: string, cerca?: Punto, radioKm = 10): Promise<Encontrada[]> {
  const params = new URLSearchParams({ key: TOMTOM_KEY!, countrySet: 'AR', limit: '5', language: 'es-419' });
  if (cerca) {
    params.set('lat', String(cerca.lat));
    params.set('lon', String(cerca.lng));
    params.set('radius', String(Math.round(radioKm * 1000)));
  }
  const res = await fetch(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(direccion)}.json?${params}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`TomTom respondió ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const datos = (await res.json()) as {
    results?: {
      type: string;
      position: { lat: number; lon: number };
      poi?: { name?: string };
      address: {
        streetName?: string;
        streetNumber?: string;
        municipalitySubdivision?: string;
        municipality?: string;
        countrySecondarySubdivision?: string;
        localName?: string;
      };
    }[];
  };
  return (datos.results ?? []).map((r) => {
    const a = r.address;
    const calle = a.streetName?.replace(/^Calle /, '');
    const lugar = r.poi?.name ?? [calle, a.streetNumber].filter(Boolean).join(' ');
    const localidades = [a.municipalitySubdivision, a.municipality, a.countrySecondarySubdivision, a.localName].filter(
      (x): x is string => !!x
    );
    return {
      nombre: r.poi?.name ?? calle ?? '',
      localidades,
      tipo: r.type,
      numero: a.streetNumber,
      direccion: [lugar, localidades[0]].filter(Boolean).join(', '),
      punto: { lat: r.position.lat, lng: r.position.lon },
      preciso: r.type !== 'Geography',
    };
  });
}

// De los resultados que corresponden a lo escrito, el más preciso: la casa
// con la altura exacta, después una altura aproximada y recién después la
// calle sola (cae en el medio de la calle, a cuadras de la casa). TomTom ya
// los ordena por parecido y cercanía, así que entre iguales gana el primero.
function elegirMejor(texto: string, resultados: Encontrada[]): Encontrada | null {
  const altura = limpiar(texto).split(',')[0].match(/\b\d{1,5}\b/)?.[0];
  const puntaje = (r: Encontrada) =>
    altura && r.numero === altura && r.tipo === 'Point Address' ? 0
    : altura && r.numero === altura ? 1
    : r.tipo === 'Point Address' || r.tipo === 'Address Range' ? 2
    : 3;
  const candidatos = resultados.filter((r) => coincide(texto, r.nombre));
  return candidatos.sort((a, b) => puntaje(a) - puntaje(b))[0] ?? null;
}

// ¿La localidad que escribió el cliente es la del resultado, o al menos está
// cerca del local? ("Manuel Alberti" para algo que TomTom pone en Del Viso
// sí; "CABA" para una Corrientes de Escobar no.)
async function localidadAceptable(localidad: string, r: Encontrada, cerca: Punto): Promise<boolean> {
  const escrita = palabras(localidad);
  if (!escrita.length || !r.localidades) return true;
  const delResultado = r.localidades.flatMap(palabras);
  if (escrita.some((p) => delResultado.some((q) => parecidas(p, q)))) return true;
  try {
    const [lugar] = await buscarTomTom(localidad); // sin acotar a la zona
    return !lugar || lineaRecta(lugar.punto, cerca) < 20_000;
  } catch {
    return true; // ante la duda, no se rechaza
  }
}

// undefined: TomTom no está configurado, falló o no encontró nada (se prueba
// con OpenStreetMap). null: encontró algo pero en otra localidad.
async function ubicarConTomTom(texto: string, cerca: Punto, radioKm: number): Promise<Encontrada | null | undefined> {
  if (!TOMTOM_KEY) return undefined;
  try {
    const r = elegirMejor(texto, await buscarTomTom(limpiar(texto), cerca, radioKm));
    if (!r) return undefined;
    const { localidad } = variantes(texto);
    if (localidad && !(await localidadAceptable(localidad, r, cerca))) return null;
    return r;
  } catch (err) {
    console.error('TomTom falló, pruebo con OpenStreetMap:', err);
    return undefined;
  }
}

// Nominatim. place_rank: 16 ciudad, 20 barrio grande, 22 barrio, 26 calle,
// 30 casa. En la zona casi no hay alturas cargadas, así que se acepta la calle.
async function buscarNominatim(direccion: string, cerca?: Punto, radioKm = 10): Promise<Encontrada | null> {
  const params = new URLSearchParams({
    q: direccion,
    format: 'jsonv2',
    countrycodes: 'ar',
    limit: '1',
    'accept-language': 'es',
  });
  if (cerca) {
    const c = caja(cerca, radioKm);
    params.set('viewbox', `${c.oeste},${c.norte},${c.este},${c.sur}`);
    params.set('bounded', '1');
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Nominatim respondió ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const [r] = (await res.json()) as { display_name: string; lat: string; lon: string; place_rank: number }[];
  if (!r) return null;
  return {
    nombre: r.display_name.split(', ')[0],
    // "Hipólito Yrigoyen, Villa Morra, Pilar, Partido del Pilar, Buenos Aires, 1629, Argentina"
    // → "Hipólito Yrigoyen, Villa Morra, Pilar"
    direccion: r.display_name
      .split(', ')
      .filter((parte) => !/^(Partido d|Buenos Aires$|Argentina$|[A-Z]?\d{4})/.test(parte))
      .join(', '),
    punto: { lat: Number(r.lat), lng: Number(r.lon) },
    preciso: r.place_rank >= 22,
  };
}

// Photon (komoot): mismos datos de OpenStreetMap, otro servidor.
const TIPOS_IMPRECISOS_PHOTON = new Set(['city', 'district', 'county', 'state', 'country']);

async function buscarPhoton(direccion: string, cerca?: Punto, radioKm = 10): Promise<Encontrada | null> {
  const params = new URLSearchParams({ q: direccion, limit: '1', lang: 'default' });
  if (cerca) {
    const c = caja(cerca, radioKm);
    params.set('lat', String(cerca.lat));
    params.set('lon', String(cerca.lng));
    params.set('bbox', `${c.oeste},${c.sur},${c.este},${c.norte}`);
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Photon respondió ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const datos = (await res.json()) as {
    features: {
      geometry: { coordinates: [number, number] };
      properties: { type?: string; name?: string; street?: string; housenumber?: string; locality?: string; district?: string; city?: string; countrycode?: string };
    }[];
  };
  const f = datos.features.find((x) => !x.properties.countrycode || x.properties.countrycode === 'AR');
  if (!f) return null;
  const p = f.properties;
  const calle = p.street ? [p.street, p.housenumber].filter(Boolean).join(' ') : null;
  const partes = [calle ?? p.name, calle && p.name && p.type !== 'house' ? p.name : null, p.district ?? p.locality, p.city];
  return {
    nombre: p.street ?? p.name ?? '',
    direccion: partes.filter((x, i) => x && partes.indexOf(x) === i).join(', '),
    punto: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] },
    preciso: !TIPOS_IMPRECISOS_PHOTON.has(p.type ?? ''),
  };
}

// "Golf club concordia 2344, Manuel Alberti, esquina con Chaco..barrio X"
// → ["Golf club concordia 2344, Manuel Alberti", "Golf club concordia 2344"]:
// versiones más cortas para cuando el texto completo no se encuentra.
// Formato de Google → lo que entiende OpenStreetMap:
// "Mar del Plata G. C. 1748-1700, B1664 Manuel Alberti, Provincia de Buenos Aires"
// → "Mar del Plata Golf Club 1748, Manuel Alberti"
function limpiar(texto: string): string {
  return texto
    .replace(/\bG\.?\s*C\.?(?=[\s,]|$)/gi, 'Golf Club')
    .replace(/\b(\d+)\s*-\s*\d+\b/g, '$1') // rango de alturas
    .replace(/\b[A-Z]\d{4}[A-Z]{0,3}\b/g, '') // código postal (B1664)
    .replace(/\b(?:provincia de )?buenos aires\b|\bargentina\b/gi, '')
    .replace(/(\s*,\s*)+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '');
}

function variantes(texto: string): { consultas: string[]; calle: string; localidad: string } {
  const limpio = limpiar(texto);
  const sinAgregados = limpio
    .split(/\b(?:esquina|esq\.?|entre|barrio|b°|lote|casa|depto|dpto|piso|timbre)\b/i)[0]
    .replace(/[\s,.;]+$/, '');
  const partes = sinAgregados.split(',').map((p) => p.trim()).filter(Boolean);
  const candidatas = [limpio, sinAgregados, partes.slice(0, 2).join(', '), partes[0] ?? ''];
  return {
    consultas: candidatas.filter((c, i) => c.length >= 4 && c !== texto && candidatas.indexOf(c) === i),
    calle: (partes[0] ?? '').replace(/\d+/g, '').replace(/\s+/g, ' ').trim(),
    localidad: partes[1] ?? '',
  };
}

// El texto tal cual y, si no aparece, sus versiones más cortas.
async function ubicarTexto(texto: string, cerca: Punto, radioKm: number): Promise<Encontrada | null> {
  const tomtom = await ubicarConTomTom(texto, cerca, radioKm);
  if (tomtom !== undefined) return tomtom;
  const { consultas, calle, localidad } = variantes(texto);
  for (const consulta of [texto, ...consultas]) {
    const r = await geocodificar(consulta, cerca, radioKm);
    if (r) return r;
  }
  // Por último, solo la calle: OpenStreetMap a veces la pone en el barrio de
  // al lado (ej. Del Viso en vez de Manuel Alberti). Solo si la localidad
  // escrita está cerca del local: "Corrientes 1234, CABA" no es la
  // Corrientes de Manuel Alberti.
  if (calle.length < 4 || consultas.includes(calle)) return null;
  if (localidad && !(await geocodificar(localidad, cerca, radioKm))) return null;
  return await geocodificar(calle, cerca, radioKm);
}

// Palabras que no sirven para saber si el resultado es la calle buscada.
const GENERICAS = new Set([
  'golf', 'club', 'calle', 'avenida', 'barrio', 'pasaje', 'ruta', 'manuel', 'alberti', 'pilar', 'viso',
  'escobar', 'garin', 'provincia', 'buenos', 'aires', 'partido', 'esquina', 'entre',
  // títulos: "Gral. San Martín" es la misma calle que "José de San Martín"
  'gral', 'general', 'pres', 'presidente', 'doctor', 'ingeniero', 'teniente', 'coronel', 'almirante',
]);

function palabras(texto: string): string[] {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-zñ]{4,}/g) ?? [];
}

function distanciaEdicion(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = arriba;
    }
  }
  return fila[b.length];
}

// ¿El resultado comparte alguna palabra importante con lo escrito? Photon
// devuelve cualquier cosa parecida ("Golf Club Golfers" para "Mar del
// Plata G. C.", "Ramón Fernández" para "San Fernando"): mejor no encontrar
// nada que cotizar otra calle. Tolera una letra de diferencia (Irigoyen /
// Yrigoyen); dos solo en palabras largas.
function parecidas(a: string, b: string): boolean {
  if (a.length < 5) return a === b;
  return distanciaEdicion(a, b) <= (a.length >= 10 ? 2 : 1);
}

function coincide(consulta: string, nombre: string): boolean {
  const claves = palabras(consulta).filter((p) => !GENERICAS.has(p));
  if (!claves.length) return true;
  const delNombre = palabras(nombre);
  return claves.some((c) => delNombre.some((n) => parecidas(c, n)));
}

// Nominatim primero; Photon si falla o no encuentra nada (Photon tolera
// mejor los nombres incompletos, ej. "Golf club concordia 2344").
async function geocodificar(direccion: string, cerca?: Punto, radioKm?: number): Promise<Encontrada | null> {
  try {
    const r = await buscarNominatim(direccion, cerca, radioKm);
    if (r && coincide(direccion, r.nombre)) return r;
  } catch (err) {
    console.error('Nominatim falló, pruebo con Photon:', err);
  }
  try {
    const r = await buscarPhoton(direccion, cerca, radioKm);
    return r && coincide(direccion, r.nombre) ? r : null;
  } catch (err) {
    console.error('Photon falló:', err);
    throw new ErrorVisible('No pudimos buscar tu dirección. Probá de nuevo en unos minutos.', 502);
  }
}

function lineaRecta(a: Punto, b: Punto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// Distancia en auto por calle: el camino más corto según TomTom; si no,
// OSRM (servidor público); si no, una estimación.
async function distanciaPorCalle(origen: Punto, destino: Punto): Promise<number> {
  if (TOMTOM_KEY) {
    try {
      const res = await fetch(
        `https://api.tomtom.com/routing/1/calculateRoute/${origen.lat},${origen.lng}:${destino.lat},${destino.lng}/json?key=${TOMTOM_KEY}&travelMode=car&routeType=shortest`,
        { signal: AbortSignal.timeout(8000) }
      );
      const datos = await res.json();
      const metros = datos.routes?.[0]?.summary?.lengthInMeters;
      if (typeof metros === 'number') return metros;
      console.error('TomTom (rutas) respondió', res.status, JSON.stringify(datos).slice(0, 300));
    } catch (err) {
      console.error('TomTom (rutas) no respondió', err);
    }
  }
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${origen.lng},${origen.lat};${destino.lng},${destino.lat}?overview=false`,
      { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) }
    );
    const datos = await res.json();
    if (datos.code === 'Ok' && datos.routes?.length) return Math.round(datos.routes[0].distance);
    console.error('OSRM respondió', res.status, JSON.stringify(datos));
  } catch (err) {
    console.error('OSRM no respondió', err);
  }
  return Math.round(lineaRecta(origen, destino) * FACTOR_CALLES);
}

// Qué dirección hay en un punto (el pin del mapa), para que recepción vea
// "Formosa 1250" y no solo lo que escribió el cliente. La altura es aproximada.
async function direccionEn(p: Punto): Promise<string | null> {
  try {
    if (TOMTOM_KEY) {
      const res = await fetch(
        `https://api.tomtom.com/search/2/reverseGeocode/${p.lat},${p.lng}.json?key=${TOMTOM_KEY}&language=es-419`,
        { signal: AbortSignal.timeout(8000) }
      );
      const datos = await res.json();
      const a = datos.addresses?.[0]?.address;
      if (a?.streetName) {
        const calle = [a.streetName.replace(/^Calle /, ''), a.streetNumber].filter(Boolean).join(' ');
        return [calle, a.municipalitySubdivision ?? a.municipality].filter(Boolean).join(', ');
      }
    }
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${p.lat}&lon=${p.lng}&limit=1`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    const f = (await res.json()).features?.[0]?.properties;
    if (f?.street) return [[f.street, f.housenumber].filter(Boolean).join(' '), f.district ?? f.city].filter(Boolean).join(', ');
  } catch (err) {
    console.error('No se pudo averiguar la dirección del pin', err);
  }
  return null;
}

// Coordenadas del local: se buscan una sola vez y quedan guardadas.
async function ubicacionLocal(cfg: Configuracion): Promise<Punto> {
  if (cfg.local_lat != null && cfg.local_lng != null) return { lat: cfg.local_lat, lng: cfg.local_lng };
  const r = await geocodificar(cfg.direccion_local);
  if (!r) {
    throw new ErrorVisible(
      `No encontramos la dirección del local ("${cfg.direccion_local}") en el mapa: cargá local_lat y local_lng en la tabla configuracion.`,
      500
    );
  }
  const punto = r.punto;
  await db.from('configuracion').update({ local_lat: punto.lat, local_lng: punto.lng }).eq('id', 1);
  return punto;
}

function puntoValido(valor: unknown): Punto | null {
  const p = valor as Partial<Punto> | null;
  if (typeof p?.lat !== 'number' || typeof p?.lng !== 'number') return null;
  if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return null;
  return { lat: p.lat, lng: p.lng };
}

const km = (metros: number) => Math.round(metros / 100) / 10;
const kmTexto = (valor: number) => valor.toLocaleString('es-AR', { maximumFractionDigits: 1 });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido.' }, 405);

  try {
    const { direccion, ubicacion, soloUbicar } = await req.json().catch(() => ({}));
    if (typeof direccion !== 'string' || direccion.trim().length < 4 || direccion.length > 200) {
      return respuesta({ error: 'Escribí tu dirección: calle, altura y localidad.' }, 400);
    }
    const pin = puntoValido(ubicacion);
    if (ubicacion != null && !pin) return respuesta({ error: 'Ubicación inválida.' }, 400);
    const buscada = direccion.trim().replace(/\s+/g, ' ');
    // Un pin se guarda con su propia clave: no lo reusa otra búsqueda por texto.
    const clave = pin ? `pin:${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}` : normalizar(direccion);

    const { data: cfg, error: errorCfg } = await db
      .from('configuracion')
      .select('direccion_local, delivery_activo, envio_km_maximo, local_lat, local_lng')
      .eq('id', 1)
      .single<Configuracion>();
    if (errorCfg) throw errorCfg;
    if (!cfg.delivery_activo) throw new ErrorVisible('Por ahora no hacemos delivery: podés retirar en el local.');
    const kmMaximo = Number(cfg.envio_km_maximo);

    if (soloUbicar === true) {
      const local = await ubicacionLocal(cfg);
      const r = await ubicarTexto(buscada, local, kmMaximo + 3);
      return respuesta({ ubicacion: r?.punto ?? null });
    }

    const desde = new Date(Date.now() - DIAS_CACHE * 24 * 60 * 60 * 1000).toISOString();
    const { data: previa } = await db
      .from('cotizaciones_envio')
      .select('direccion_encontrada, lat, lng, distancia_m, marcada')
      .eq('clave', clave)
      .gte('creado_en', desde)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle();

    let medida = previa;
    if (!medida && pin) {
      const local = await ubicacionLocal(cfg);
      // Más lejos que esto no tiene sentido pedirle la ruta a OSRM.
      if (lineaRecta(local, pin) > (kmMaximo + 20) * 1000) {
        throw new ErrorVisible(`Ese punto queda lejos: llegamos hasta ${kmTexto(kmMaximo)} km del local.`);
      }
      const enElPin = await direccionEn(pin);
      medida = {
        direccion_encontrada: enElPin ? `${enElPin} (marcado en el mapa)` : 'Ubicación marcada en el mapa',
        marcada: true,
        lat: pin.lat,
        lng: pin.lng,
        distancia_m: await distanciaPorCalle(local, pin),
      };
    }
    if (!medida) {
      const local = await ubicacionLocal(cfg);
      const r = await ubicarTexto(buscada, local, kmMaximo + 3);
      if (!r) {
        throw new ErrorVisible(
          `No encontramos esa calle en el mapa (algunas calles de la zona no tienen nombre cargado). Marcá tu casa en el mapa.`
        );
      }
      if (!r.preciso) {
        throw new ErrorVisible('Necesitamos la calle, no solo la localidad (ej: Irigoyen 1234, Pilar).');
      }
      const destino = r.punto;
      medida = {
        direccion_encontrada: r.direccion,
        marcada: false,
        lat: destino.lat,
        lng: destino.lng,
        distancia_m: await distanciaPorCalle(local, destino),
      };
    }

    const { data: costo, error: errorCosto } = await db.rpc('costo_envio', { p_metros: medida.distancia_m });
    if (errorCosto) throw errorCosto;
    if (costo == null) {
      throw new ErrorVisible(
        `Tu dirección está a ${kmTexto(km(medida.distancia_m))} km y llegamos hasta ${kmTexto(kmMaximo)} km. Podés retirar en el local.`
      );
    }

    // Cada cotización es una fila nueva: crear_pedido solo acepta las del último día.
    const { data: fila, error } = await db
      .from('cotizaciones_envio')
      .insert({ clave, direccion_buscada: buscada, ...medida })
      .select('id')
      .single();
    if (error) throw error;

    return respuesta({
      id: fila.id,
      direccion: medida.direccion_encontrada,
      distanciaKm: km(medida.distancia_m),
      costo,
      ubicacion: { lat: medida.lat, lng: medida.lng },
    });
  } catch (err) {
    console.error(err);
    if (err instanceof ErrorVisible) return respuesta({ error: err.message }, err.status);
    return respuesta({ error: 'No pudimos calcular el envío. Probá de nuevo en unos minutos.' }, 502);
  }
});
