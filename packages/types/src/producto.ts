export type CategoriaBase =
  | 'arepa'
  | 'tequeño'
  | 'empanada'
  | 'bebida'
  | 'postre'
  | 'acompañamiento'
  | 'combo';

export type CategoriaMomento =
  | 'promociones'
  | 'almuerzos'
  | 'cena'
  | 'desayunos'
  | 'postres'
  | 'combos';

export type Relleno = 'carne' | 'queso' | 'porotos' | 'pollo';

// URL de Supabase Storage (productos cargados desde staff), clave de una
// foto incluida en las apps (catálogo inicial, ej. "arepa-pollo") o el
// número que devuelve require().
export type ImagenProducto = string | number;

export interface OpcionGrupo {
  id: string;
  nombre: string;
  precioAdicional: number; // puede ser 0
  agotado?: boolean; // RF-12: se calcula a partir de `ingredientes`
  ingredientes?: string[]; // ids de la tabla `ingredientes`
}

// Un grupo de opciones dentro de un producto (RF-12, "opciones de combo").
// - 'unica': se elige exactamente una (ej. cocción Asada / Frita).
// - 'cantidad': cada opción tiene su propio selector -2+ y la suma debe
//   quedar entre `minimo` y `maximo` (ej. "Elegí 4 empanadas").
export interface GrupoOpciones {
  id: string;
  nombre: string;
  tipo: 'unica' | 'cantidad';
  categoria?: CategoriaBase;
  minimo: number;
  maximo: number;
  opciones: OpcionGrupo[];
  // Agrupa visualmente varios grupos en una misma tarjeta. Ej. en un combo,
  // "Arepa 1" reúne el grupo "Relleno" y el grupo "Cocción" de esa arepa.
  seccion?: string;
  // Si es true no se preselecciona nada: el cliente tiene que elegir
  // (ej. el relleno de cada arepa). Si no, en los grupos 'unica' se
  // preselecciona la primera opción disponible (ej. cocción "Asada").
  elegirManual?: boolean;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  imagen: ImagenProducto;
  precio: number;
  categoriaBase: CategoriaBase;
  categoriasMomento: CategoriaMomento[];
  rellenos?: Relleno[];
  descuentoPorcentaje?: number; // si tiene, entra automáticamente a "promociones"
  esCombo: boolean;
  gruposOpciones?: GrupoOpciones[];
  acompañamientos?: string[];
  activo: boolean; // false = desactivado por tiempo indefinido
  desactivadoHasta?: string | null; // ISO: "sin stock por hoy" hasta esa hora
  agotado?: boolean; // se calcula: algún ingrediente del producto está agotado
  ingredientes?: string[]; // ids de la tabla `ingredientes`
  orden?: number; // posición dentro de su categoría en el menú
}

export interface Ingrediente {
  id: string;
  nombre: string;
  agotado: boolean;
}
