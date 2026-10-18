// POST { direccion } → { id, direccion, distanciaKm, costo }
// Busca la dirección en OpenStreetMap (Nominatim, y Photon si Nominatim
// falla: suele bloquear servidores en la nube), mide la distancia por
// calle desde el local (OSRM) y la guarda en cotizaciones_envio. El checkout
// manda el `id` al crear el pedido: crear_pedido lee la distancia de la base
// y recalcula el costo, así que el cliente no puede mandar una distancia
// inventada.
//
// Los dos servicios son gratis y sin clave, pero piden uso moderado
// (Nominatim: 1 consulta por segundo e identificarse con un User-Agent).
// Por eso cada dirección medida se reusa 30 días.
// Secretos (opcional, Supabase → Edge Functions → Secrets):
//   CONTACTO_OSM  mail de contacto que se manda en el User-Agent
// Deploy: npx supabase functions deploy cotizar-envio --no-verify-jwt

import { cors, db, respuesta } from '../_shared/comun.ts';

// Una dirección ya medida se reusa sin volver a consultar.
const DIAS_CACHE = 30;
// Si OSRM no responde, la distancia por calle se estima como la línea recta
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
    direccion: partes.filter((x, i) => x && partes.indexOf(x) === i).join(', '),
    punto: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] },
    preciso: !TIPOS_IMPRECISOS_PHOTON.has(p.type ?? ''),
  };
}

async function geocodificar(direccion: string, cerca?: Punto, radioKm?: number): Promise<Encontrada | null> {
  try {
    return await buscarNominatim(direccion, cerca, radioKm);
  } catch (err) {
    console.error('Nominatim falló, pruebo con Photon:', err);
  }
  try {
    return await buscarPhoton(direccion, cerca, radioKm);
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

// Distancia en auto por calle (servidor público de OSRM).
async function distanciaPorCalle(origen: Punto, destino: Punto): Promise<number> {
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

const km = (metros: number) => Math.round(metros / 100) / 10;
const kmTexto = (valor: number) => valor.toLocaleString('es-AR', { maximumFractionDigits: 1 });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido.' }, 405);

  try {
    const { direccion } = await req.json().catch(() => ({}));
    if (typeof direccion !== 'string' || direccion.trim().length < 4 || direccion.length > 200) {
      return respuesta({ error: 'Escribí tu dirección: calle, altura y localidad.' }, 400);
    }
    const buscada = direccion.trim().replace(/\s+/g, ' ');
    const clave = normalizar(direccion);

    const { data: cfg, error: errorCfg } = await db
      .from('configuracion')
      .select('direccion_local, delivery_activo, envio_km_maximo, local_lat, local_lng')
      .eq('id', 1)
      .single<Configuracion>();
    if (errorCfg) throw errorCfg;
    if (!cfg.delivery_activo) throw new ErrorVisible('Por ahora no hacemos delivery: podés retirar en el local.');
    const kmMaximo = Number(cfg.envio_km_maximo);

    const desde = new Date(Date.now() - DIAS_CACHE * 24 * 60 * 60 * 1000).toISOString();
    const { data: previa } = await db
      .from('cotizaciones_envio')
      .select('direccion_encontrada, lat, lng, distancia_m')
      .eq('clave', clave)
      .gte('creado_en', desde)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle();

    let medida = previa;
    if (!medida) {
      const local = await ubicacionLocal(cfg);
      const r = await geocodificar(buscada, local, kmMaximo + 3);
      if (!r) {
        throw new ErrorVisible(
          `No encontramos esa dirección a menos de ${kmTexto(kmMaximo)} km del local. Revisá la calle y agregá la localidad (ej: Irigoyen 1234, Pilar).`
        );
      }
      if (!r.preciso) {
        throw new ErrorVisible('Necesitamos la calle, no solo la localidad (ej: Irigoyen 1234, Pilar).');
      }
      const destino = r.punto;
      medida = {
        direccion_encontrada: r.direccion,
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
    });
  } catch (err) {
    console.error(err);
    if (err instanceof ErrorVisible) return respuesta({ error: err.message }, err.status);
    return respuesta({ error: 'No pudimos calcular el envío. Probá de nuevo en unos minutos.' }, 502);
  }
});
