import type { CategoriaBase, GrupoOpciones, OpcionGrupo } from '@sabor/types';

// Plantillas de opciones que usan el catálogo inicial y el editor de
// productos de staff. Así un combo nuevo se arma igual que los existentes.

// Ingredientes base (tabla `ingredientes`). Si uno se marca agotado, se
// deshabilitan los productos y opciones que lo usan (RF-12).
export const INGREDIENTES_BASE = [
  { id: 'carne-mechada', nombre: 'Carne mechada' },
  { id: 'pollo', nombre: 'Pollo desmechado' },
  { id: 'queso', nombre: 'Queso blanco' },
  { id: 'porotos', nombre: 'Porotos negros' },
  { id: 'queso-llanero', nombre: 'Queso llanero (tequeños)' },
] as const;

// Rellenos para elegir en cada pieza del combo. Los especiales tienen costo
// adicional, que se edita desde recepción (Menú → Rellenos).
export const RELLENOS_COMBO = [
  { clave: 'carne', nombre: 'Carne mechada', ingredientes: ['carne-mechada'] },
  { clave: 'pollo', nombre: 'Pollo', ingredientes: ['pollo'] },
  { clave: 'queso', nombre: 'Queso', ingredientes: ['queso'] },
  { clave: 'porotos', nombre: 'Porotos', ingredientes: ['porotos'] },
  { clave: 'domino', nombre: 'Porotos y queso', ingredientes: ['porotos', 'queso'] },
  { clave: 'catira', nombre: 'Catira', ingredientes: ['pollo', 'queso'] },
  { clave: 'pelua', nombre: 'Pelúa', ingredientes: ['carne-mechada', 'queso'] },
  { clave: 'pabellon', nombre: 'Pabellón', ingredientes: ['carne-mechada', 'porotos', 'queso'] },
] as const;

export type PiezaCombo = 'arepa' | 'empanada';

// Precio adicional de cada relleno (clave de RELLENOS_COMBO) por tipo de pieza.
export type PreciosRelleno = Record<PiezaCombo, Record<string, number>>;

// En arepas el extra es el doble que en empanadas, como en la web anterior.
export const PRECIOS_RELLENO_INICIALES: PreciosRelleno = {
  arepa: { catira: 400, pelua: 400, pabellon: 800 },
  empanada: { catira: 200, pelua: 200, pabellon: 400 },
};

export function opcionesDeRelleno(pieza: PiezaCombo, precios: PreciosRelleno = PRECIOS_RELLENO_INICIALES): OpcionGrupo[] {
  return RELLENOS_COMBO.map((r) => ({
    id: `${pieza}-${r.clave}`,
    nombre: r.nombre,
    precioAdicional: precios[pieza][r.clave] ?? 0,
    ingredientes: [...r.ingredientes],
  }));
}

// Grupo "Relleno" de una pieza de combo (ej. id "arepa-2-relleno").
function esGrupoRelleno(g: GrupoOpciones): g is GrupoOpciones & { categoria: PiezaCombo } {
  return (g.categoria === 'arepa' || g.categoria === 'empanada') && g.id.endsWith('-relleno');
}

// Precios de relleno que usan hoy los combos (el primero que aparezca de
// cada uno), completados con los iniciales.
export function preciosDeRellenos(productos: { gruposOpciones?: GrupoOpciones[] }[]): PreciosRelleno {
  const precios: PreciosRelleno = {
    arepa: Object.fromEntries(RELLENOS_COMBO.map((r) => [r.clave, PRECIOS_RELLENO_INICIALES.arepa[r.clave] ?? 0])),
    empanada: Object.fromEntries(RELLENOS_COMBO.map((r) => [r.clave, PRECIOS_RELLENO_INICIALES.empanada[r.clave] ?? 0])),
  };
  const vistos = new Set<string>();
  for (const p of productos) {
    for (const g of (p.gruposOpciones ?? []).filter(esGrupoRelleno)) {
      for (const o of g.opciones) {
        const clave = o.id.slice(g.categoria.length + 1);
        if (!(clave in precios[g.categoria]) || vistos.has(o.id)) continue;
        vistos.add(o.id);
        precios[g.categoria][clave] = o.precioAdicional;
      }
    }
  }
  return precios;
}

// Devuelve los grupos con los precios de relleno actualizados, o null si
// no cambia nada (así solo se guardan los combos afectados).
export function aplicarPreciosRelleno(grupos: GrupoOpciones[] | undefined, precios: PreciosRelleno): GrupoOpciones[] | null {
  let cambio = false;
  const nuevos = (grupos ?? []).map((g) => {
    if (!esGrupoRelleno(g)) return g;
    return {
      ...g,
      opciones: g.opciones.map((o) => {
        const precio = precios[g.categoria][o.id.slice(g.categoria.length + 1)];
        if (precio === undefined || precio === o.precioAdicional) return o;
        cambio = true;
        return { ...o, precioAdicional: precio };
      }),
    };
  });
  return cambio ? nuevos : null;
}

export const GRUPO_COCCION: GrupoOpciones = {
  id: 'coccion',
  nombre: 'Cocción',
  tipo: 'unica',
  categoria: 'arepa',
  minimo: 1,
  maximo: 1,
  opciones: [
    { id: 'asada', nombre: 'Asada', precioAdicional: 0 },
    { id: 'frita', nombre: 'Frita', precioAdicional: 0 },
  ],
};

// Cada arepa del combo se arma por separado: relleno (obligatorio, sin
// preselección) y cocción (Asada por defecto).
export function arepasDelCombo(cantidad: number, precios?: PreciosRelleno): GrupoOpciones[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const seccion = `Arepa ${i + 1}`;
    const grupos: GrupoOpciones[] = [
      {
        id: `arepa-${i + 1}-relleno`,
        nombre: 'Relleno',
        seccion,
        tipo: 'unica',
        categoria: 'arepa',
        minimo: 1,
        maximo: 1,
        elegirManual: true,
        opciones: opcionesDeRelleno('arepa', precios),
      },
      { ...GRUPO_COCCION, id: `arepa-${i + 1}-coccion`, seccion },
    ];
    return grupos;
  }).flat();
}

export function empanadasDelCombo(cantidad: number, precios?: PreciosRelleno): GrupoOpciones[] {
  return Array.from({ length: cantidad }, (_, i) => ({
    id: `empanada-${i + 1}-relleno`,
    nombre: 'Relleno',
    seccion: `Empanada ${i + 1}`,
    tipo: 'unica' as const,
    categoria: 'empanada' as const,
    minimo: 1,
    maximo: 1,
    elegirManual: true,
    opciones: opcionesDeRelleno('empanada', precios),
  }));
}

export interface PiezasCombo {
  arepas: number;
  empanadas: number;
}

// Grupos de opciones de un producto según su configuración en el editor:
// - combo: una pieza por arepa/empanada.
// - arepa suelta: elegir cocción.
// - resto: sin opciones.
export function gruposParaProducto(
  categoria: CategoriaBase,
  esCombo: boolean,
  piezas: PiezasCombo,
  precios?: PreciosRelleno
): GrupoOpciones[] {
  if (esCombo) return [...arepasDelCombo(piezas.arepas, precios), ...empanadasDelCombo(piezas.empanadas, precios)];
  if (categoria === 'arepa') return [GRUPO_COCCION];
  return [];
}

// Inversa de gruposParaProducto: cuántas arepas/empanadas tiene un combo.
export function piezasDeCombo(grupos: GrupoOpciones[] | undefined): PiezasCombo {
  const secciones = new Set((grupos ?? []).map((g) => g.seccion).filter(Boolean));
  return {
    arepas: [...secciones].filter((s) => s!.startsWith('Arepa')).length,
    empanadas: [...secciones].filter((s) => s!.startsWith('Empanada')).length,
  };
}
