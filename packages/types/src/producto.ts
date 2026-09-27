export type CategoriaBase =
  | 'arepa'
  | 'tequeño'
  | 'empanada'
  | 'bebida'
  | 'postre'
  | 'acompañamiento';

export type CategoriaMomento =
  | 'promociones'
  | 'almuerzos'
  | 'desayunos'
  | 'postres'
  | 'combos';

export type Relleno = 'carne' | 'queso' | 'porotos' | 'pollo';

export interface OpcionCombo {
  id: string;
  nombre: string;
  precioAdicional: number; // puede ser 0
  categoria: CategoriaBase;
  minimo: number;
  maximo: number;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  imagenUrl: string;
  precio: number;
  categoriaBase: CategoriaBase;
  categoriasMomento: CategoriaMomento[];
  rellenos?: Relleno[];
  descuentoPorcentaje?: number; // si tiene, entra automáticamente a "promociones"
  esCombo: boolean;
  opcionesCombo?: OpcionCombo[];
  acompañamientos?: string[];
  activo: boolean; // false = desactivado (por el día o indefinido)
  agotado?: boolean; // se desactiva automáticamente si el ingrediente está agotado
}
