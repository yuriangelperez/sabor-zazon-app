import type { CategoriaBase, CategoriaMomento, Producto, Relleno } from '@sabor/types';

import { estaDisponible } from './disponibilidad';

export interface FiltrosMenu {
  texto: string;
  categoriaBase: CategoriaBase | null;
  categoriaMomento: CategoriaMomento | null;
  rellenos: Relleno[];
}

export const FILTROS_VACIOS: FiltrosMenu = {
  texto: '',
  categoriaBase: null,
  categoriaMomento: null,
  rellenos: [],
};

// "Tequeño" y "tequeno" deben encontrar lo mismo.
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Un producto con descuento entra a "promociones" aunque no esté etiquetado.
export function perteneceAMomento(producto: Producto, momento: CategoriaMomento): boolean {
  if (momento === 'promociones' && (producto.descuentoPorcentaje ?? 0) > 0) return true;
  return producto.categoriasMomento.includes(momento);
}

// RF-02: búsqueda por palabras o frases + filtros combinables.
// El menú del cliente oculta lo no disponible; staff lo ve todo (RF-12).
export function filtrarProductos(
  productos: Producto[],
  filtros: FiltrosMenu,
  { soloDisponibles = true }: { soloDisponibles?: boolean } = {}
): Producto[] {
  const palabras = normalizarTexto(filtros.texto).split(/\s+/).filter(Boolean);

  return productos.filter((p) => {
    if (soloDisponibles && !estaDisponible(p)) return false;
    if (filtros.categoriaBase && p.categoriaBase !== filtros.categoriaBase) return false;
    if (filtros.categoriaMomento && !perteneceAMomento(p, filtros.categoriaMomento)) return false;
    if (filtros.rellenos.length > 0 && !filtros.rellenos.every((r) => p.rellenos?.includes(r))) {
      return false;
    }
    if (palabras.length === 0) return true;

    const buscable = normalizarTexto(
      [p.nombre, p.descripcion, p.categoriaBase, ...(p.rellenos ?? [])].join(' ')
    );
    return palabras.every((palabra) => buscable.includes(palabra));
  });
}
