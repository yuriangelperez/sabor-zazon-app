import type { Ingrediente, Producto } from '@sabor/types';

// RF-12: un producto se muestra si está activo y no fue pausado "por hoy".
export function estaDisponible(producto: Producto, ahora: Date = new Date()): boolean {
  if (!producto.activo) return false;
  if (producto.desactivadoHasta && new Date(producto.desactivadoHasta) > ahora) return false;
  return true;
}

export type EstadoDisponibilidad = 'disponible' | 'sin_stock_hoy' | 'desactivado';

export function estadoDisponibilidad(producto: Producto, ahora: Date = new Date()): EstadoDisponibilidad {
  if (!producto.activo) return 'desactivado';
  if (producto.desactivadoHasta && new Date(producto.desactivadoHasta) > ahora) return 'sin_stock_hoy';
  return 'disponible';
}

// Fin del día de hoy: hasta cuándo dura "sin stock por hoy".
export function finDelDia(ahora: Date = new Date()): Date {
  const fin = new Date(ahora);
  fin.setHours(23, 59, 59, 999);
  return fin;
}

// Marca como agotados los productos y opciones que usan un ingrediente
// agotado. Un combo sigue disponible mientras cada pieza tenga al menos una
// opción posible; si alguna pieza se queda sin opciones, el combo se agota.
export function aplicarIngredientesAgotados(productos: Producto[], ingredientes: Ingrediente[]): Producto[] {
  const agotados = new Set(ingredientes.filter((i) => i.agotado).map((i) => i.id));
  if (agotados.size === 0) return productos;
  const usaAgotado = (ids?: string[]) => (ids ?? []).some((id) => agotados.has(id));

  return productos.map((p) => {
    const grupos = p.gruposOpciones?.map((g) => ({
      ...g,
      opciones: g.opciones.map((o) => ({ ...o, agotado: o.agotado || usaAgotado(o.ingredientes) })),
    }));
    const piezaSinOpciones = (grupos ?? []).some((g) => g.opciones.every((o) => o.agotado));
    return {
      ...p,
      gruposOpciones: grupos,
      agotado: p.agotado || usaAgotado(p.ingredientes) || piezaSinOpciones,
    };
  });
}
