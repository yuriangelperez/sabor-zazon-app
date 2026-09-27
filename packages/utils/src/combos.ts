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
// adicional (en arepas el doble que en empanadas, como en la web anterior).
export function opcionesDeRelleno(prefijo: string, extraEspecial: number): OpcionGrupo[] {
  return [
    { id: `${prefijo}-carne`, nombre: 'Carne mechada', precioAdicional: 0, ingredientes: ['carne-mechada'] },
    { id: `${prefijo}-pollo`, nombre: 'Pollo', precioAdicional: 0, ingredientes: ['pollo'] },
    { id: `${prefijo}-queso`, nombre: 'Queso', precioAdicional: 0, ingredientes: ['queso'] },
    { id: `${prefijo}-porotos`, nombre: 'Porotos', precioAdicional: 0, ingredientes: ['porotos'] },
    { id: `${prefijo}-domino`, nombre: 'Porotos y queso', precioAdicional: 0, ingredientes: ['porotos', 'queso'] },
    { id: `${prefijo}-catira`, nombre: 'Catira', precioAdicional: extraEspecial, ingredientes: ['pollo', 'queso'] },
    { id: `${prefijo}-pelua`, nombre: 'Pelúa', precioAdicional: extraEspecial, ingredientes: ['carne-mechada', 'queso'] },
    {
      id: `${prefijo}-pabellon`,
      nombre: 'Pabellón',
      precioAdicional: extraEspecial * 2,
      ingredientes: ['carne-mechada', 'porotos', 'queso'],
    },
  ];
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
export function arepasDelCombo(cantidad: number): GrupoOpciones[] {
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
        opciones: opcionesDeRelleno('arepa', 400),
      },
      { ...GRUPO_COCCION, id: `arepa-${i + 1}-coccion`, seccion },
    ];
    return grupos;
  }).flat();
}

export function empanadasDelCombo(cantidad: number): GrupoOpciones[] {
  return Array.from({ length: cantidad }, (_, i) => ({
    id: `empanada-${i + 1}-relleno`,
    nombre: 'Relleno',
    seccion: `Empanada ${i + 1}`,
    tipo: 'unica' as const,
    categoria: 'empanada' as const,
    minimo: 1,
    maximo: 1,
    elegirManual: true,
    opciones: opcionesDeRelleno('empanada', 200),
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
  piezas: PiezasCombo
): GrupoOpciones[] {
  if (esCombo) return [...arepasDelCombo(piezas.arepas), ...empanadasDelCombo(piezas.empanadas)];
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
