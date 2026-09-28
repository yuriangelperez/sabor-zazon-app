import type { CategoriaBase, CategoriaMomento, Relleno } from '@sabor/types';

// Orden y nombres visibles de las categorías (menú del cliente y de staff).

export const CATEGORIAS_BASE: { id: CategoriaBase; label: string }[] = [
  { id: 'arepa', label: 'Arepas' },
  { id: 'tequeño', label: 'Tequeños' },
  { id: 'empanada', label: 'Empanadas' },
  { id: 'bebida', label: 'Bebidas' },
  { id: 'postre', label: 'Postres' },
  { id: 'acompañamiento', label: 'Acompañamientos' },
];

export const CATEGORIAS_MOMENTO: { id: CategoriaMomento; label: string }[] = [
  { id: 'promociones', label: 'Promociones' },
  { id: 'combos', label: 'Combos' },
  { id: 'almuerzos', label: 'Almuerzos' },
  { id: 'cena', label: 'Cenas' },
  { id: 'desayunos', label: 'Desayunos' },
  { id: 'postres', label: 'Postres' },
];

export const RELLENOS: { id: Relleno; label: string }[] = [
  { id: 'carne', label: 'Carne' },
  { id: 'queso', label: 'Queso' },
  { id: 'porotos', label: 'Porotos' },
  { id: 'pollo', label: 'Pollo' },
];

// Orden de las secciones del menú: así el cliente ve todo separado por
// categoría en lugar de una sola lista larga.
export const SECCIONES_MENU: { id: CategoriaBase; titulo: string }[] = [
  { id: 'combo', titulo: 'Combos' },
  { id: 'arepa', titulo: 'Arepas' },
  { id: 'empanada', titulo: 'Empanadas' },
  { id: 'tequeño', titulo: 'Tequeños' },
  { id: 'bebida', titulo: 'Bebidas' },
  { id: 'postre', titulo: 'Postres' },
  { id: 'acompañamiento', titulo: 'Acompañamientos' },
];
