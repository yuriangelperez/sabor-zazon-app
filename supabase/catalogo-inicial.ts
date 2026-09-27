import type { Producto, Relleno } from '@sabor/types';
import { arepasDelCombo, empanadasDelCombo, GRUPO_COCCION } from '@sabor/utils';

// Menú inicial (productos y precios de la web anterior). `generar-seed.ts`
// lo convierte en supabase/seed.sql. Después el menú se administra desde la
// app de staff; este archivo ya no se usa en tiempo de ejecución.

const INGREDIENTE_POR_RELLENO: Record<Relleno, string> = {
  carne: 'carne-mechada',
  pollo: 'pollo',
  queso: 'queso',
  porotos: 'porotos',
};

type Datos = Pick<Producto, 'id' | 'nombre' | 'descripcion' | 'precio'> & { rellenos: Relleno[] };

function arepa(d: Datos, orden: number): Producto {
  return {
    ...d,
    imagen: d.id,
    descripcion: `${d.descripcion} Masa de maíz, sin TACC.`,
    categoriaBase: 'arepa',
    categoriasMomento: ['desayunos', 'almuerzos'],
    esCombo: false,
    gruposOpciones: [GRUPO_COCCION],
    ingredientes: d.rellenos.map((r) => INGREDIENTE_POR_RELLENO[r]),
    activo: true,
    orden,
  };
}

function empanada(d: Datos, orden: number): Producto {
  return {
    ...d,
    imagen: d.id,
    categoriaBase: 'empanada',
    categoriasMomento: ['desayunos', 'almuerzos'],
    esCombo: false,
    ingredientes: d.rellenos.map((r) => INGREDIENTE_POR_RELLENO[r]),
    activo: true,
    orden,
  };
}

const DESCRIPCION_TEQUENOS = 'Rellenos de queso llanero venezolano envueltos en masa de harina de trigo.';

function tequenos(
  d: Pick<Producto, 'id' | 'nombre' | 'precio' | 'imagen'> & Partial<Producto>,
  orden: number
): Producto {
  return {
    descripcion: DESCRIPCION_TEQUENOS,
    categoriaBase: 'tequeño',
    categoriasMomento: [],
    rellenos: ['queso'],
    esCombo: false,
    ingredientes: ['queso-llanero'],
    activo: true,
    orden,
    ...d,
  };
}

export const CATALOGO_INICIAL: Producto[] = [
  {
    id: 'combo-zulia',
    nombre: 'Combo Zulia',
    descripcion: '4 arepas tradicionales a elección, ideales para compartir, con 12 tequeños y salsa de ajo.',
    imagen: 'combo-zulia',
    precio: 53549,
    categoriaBase: 'combo',
    categoriasMomento: ['combos', 'almuerzos'],
    esCombo: true,
    gruposOpciones: arepasDelCombo(4),
    acompañamientos: ['12 tequeños', 'Salsa de ajo'],
    ingredientes: ['queso-llanero'],
    activo: true,
    orden: 1,
  },
  {
    id: 'combo-maracay',
    nombre: 'Combo Maracay',
    descripcion: 'La combinación perfecta: 2 arepas, 2 empanadas doradas, 6 tequeños y salsa de ajo.',
    imagen: 'combo-maracay',
    precio: 36299,
    categoriaBase: 'combo',
    categoriasMomento: ['combos', 'almuerzos'],
    esCombo: true,
    gruposOpciones: [...arepasDelCombo(2), ...empanadasDelCombo(2)],
    acompañamientos: ['6 tequeños', 'Salsa de ajo'],
    ingredientes: ['queso-llanero'],
    activo: true,
    orden: 2,
  },
  {
    id: 'combo-caracas',
    nombre: 'Combo Caracas',
    descripcion: '2 arepas acompañadas de 12 tequeños y salsa de ajo.',
    imagen: 'combo-caracas',
    precio: 34649,
    categoriaBase: 'combo',
    categoriasMomento: ['combos', 'almuerzos'],
    esCombo: true,
    gruposOpciones: arepasDelCombo(2),
    acompañamientos: ['12 tequeños', 'Salsa de ajo'],
    ingredientes: ['queso-llanero'],
    activo: true,
    orden: 3,
  },
  {
    id: 'combo-vargas',
    nombre: 'Combo Vargas',
    descripcion: 'Para un antojo rápido: 2 empanadas a elección, 6 tequeños y salsa.',
    imagen: 'combo-vargas',
    precio: 17399,
    categoriaBase: 'combo',
    categoriasMomento: ['combos'],
    esCombo: true,
    gruposOpciones: empanadasDelCombo(2),
    acompañamientos: ['6 tequeños', 'Salsa de ajo'],
    ingredientes: ['queso-llanero'],
    activo: true,
    orden: 4,
  },

  arepa({ id: 'arepa-pollo', nombre: 'Arepa de Pollo', descripcion: 'Rellena de pollo desmechado bien sazonado.', precio: 9449, rellenos: ['pollo'] }, 1),
  arepa({ id: 'arepa-queso', nombre: 'Arepa de Queso', descripcion: 'Rellena de queso blanco venezolano.', precio: 9449, rellenos: ['queso'] }, 2),
  arepa({ id: 'arepa-carne', nombre: 'Arepa de Carne Mechada', descripcion: 'Rellena de carne mechada al estilo venezolano.', precio: 9449, rellenos: ['carne'] }, 3),
  arepa({ id: 'arepa-domino', nombre: 'Arepa Dominó', descripcion: 'Deliciosa combinación de porotos negros con queso blanco venezolano.', precio: 9449, rellenos: ['porotos', 'queso'] }, 4),
  arepa({ id: 'arepa-catira', nombre: 'Arepa Catira', descripcion: 'Pollo desmechado jugoso coronado con abundante queso venezolano.', precio: 9999, rellenos: ['pollo', 'queso'] }, 5),
  arepa({ id: 'arepa-pelua', nombre: 'Arepa Pelúa', descripcion: 'La favorita: carne mechada bien sazonada combinada con queso venezolano.', precio: 9999, rellenos: ['carne', 'queso'] }, 6),
  arepa({ id: 'arepa-pabellon', nombre: 'Arepa Pabellón', descripcion: 'El plato nacional en una arepa: carne mechada, porotos negros tradicionales y queso venezolano.', precio: 10299, rellenos: ['carne', 'porotos', 'queso'] }, 7),

  empanada({ id: 'empanada-pollo', nombre: 'Empanada de Pollo', descripcion: 'Rellena de pollo desmechado.', precio: 4799, rellenos: ['pollo'] }, 1),
  empanada({ id: 'empanada-queso', nombre: 'Empanada de Queso', descripcion: 'Rellena de queso blanco venezolano.', precio: 4799, rellenos: ['queso'] }, 2),
  empanada({ id: 'empanada-carne', nombre: 'Empanada de Carne Mechada', descripcion: 'Rellena de carne mechada.', precio: 4799, rellenos: ['carne'] }, 3),
  empanada({ id: 'empanada-porotos', nombre: 'Empanada de Porotos', descripcion: 'Rellena de porotos negros.', precio: 4699, rellenos: ['porotos'] }, 4),
  empanada({ id: 'empanada-domino', nombre: 'Empanada Dominó', descripcion: 'Porotos negros con queso blanco.', precio: 4799, rellenos: ['porotos', 'queso'] }, 5),
  empanada({ id: 'empanada-catira', nombre: 'Empanada Catira', descripcion: 'Pollo desmechado con queso.', precio: 4999, rellenos: ['pollo', 'queso'] }, 6),
  empanada({ id: 'empanada-pelua', nombre: 'Empanada Pelúa', descripcion: 'Carne mechada con queso.', precio: 4999, rellenos: ['carne', 'queso'] }, 7),
  empanada({ id: 'empanada-pabellon', nombre: 'Empanada Pabellón', descripcion: 'Carne mechada, porotos negros y queso.', precio: 5199, rellenos: ['carne', 'porotos', 'queso'] }, 8),

  tequenos({
    id: 'tequenos-promo-8',
    nombre: 'Tequeños fritos Promoción',
    descripcion: '8 unidades de tequeños fritos dorados acompañados con nuestra salsa de ajo.',
    imagen: 'tequenos-12',
    precio: 10499,
    categoriasMomento: ['promociones'],
    acompañamientos: ['Salsa de ajo'],
  }, 1),
  tequenos({ id: 'tequenos-fritos-12', nombre: 'Tequeños fritos x12', imagen: 'tequenos-12', precio: 15299 }, 2),
  tequenos({ id: 'tequenos-fritos-6', nombre: 'Tequeños fritos x6', imagen: 'tequenos-12', precio: 7899 }, 3),
  tequenos({ id: 'tequenos-congelados-12', nombre: 'Tequeños congelados x12', imagen: 'tequenos-12', precio: 15199 }, 4),
  tequenos({ id: 'tequenos-congelados-6', nombre: 'Tequeños congelados x6', imagen: 'tequenos-12', precio: 7799 }, 5),
  tequenos({ id: 'tequenos-20', nombre: 'Tequeños x20', imagen: 'tequenos-20', precio: 26199 }, 6),
];
