import type { GrupoOpciones, OpcionElegida, Producto } from '@sabor/types';

export function precioConDescuento(producto: Pick<Producto, 'precio' | 'descuentoPorcentaje'>): number {
  const descuento = producto.descuentoPorcentaje ?? 0;
  return Math.round(producto.precio * (1 - descuento / 100));
}

export function totalAdicionales(opciones: OpcionElegida[]): number {
  return opciones.reduce((acc, o) => acc + o.precioAdicional * o.cantidad, 0);
}

export function precioUnitario(producto: Producto, opciones: OpcionElegida[]): number {
  return precioConDescuento(producto) + totalAdicionales(opciones);
}

// Nombre con el que se muestra una elección en el carrito y la comanda:
// "Arepa 1: Pelúa, Asada" en vez de "Relleno: Pelúa" y "Cocción: Asada".
export function nombreVisibleGrupo(grupo: GrupoOpciones): string {
  return grupo.seccion ?? grupo.nombre;
}

// Para el agregado rápido desde el menú (RF-03) y el estado inicial del
// detalle: los grupos de elección única toman su primera opción disponible
// (ej. cocción "Asada"), salvo los que el cliente tiene que elegir sí o sí.
export function opcionesPorDefecto(producto: Producto): OpcionElegida[] {
  return (producto.gruposOpciones ?? [])
    .filter((g) => g.tipo === 'unica' && !g.elegirManual)
    .flatMap((g) => {
      const opcion = g.opciones.find((o) => !o.agotado);
      if (!opcion) return [];
      return [
        {
          grupoId: g.id,
          grupoNombre: nombreVisibleGrupo(g),
          opcionId: opcion.id,
          nombre: opcion.nombre,
          cantidad: 1,
          precioAdicional: opcion.precioAdicional,
        },
      ];
    });
}

export function cantidadElegidaEnGrupo(grupo: GrupoOpciones, opciones: OpcionElegida[]): number {
  return opciones
    .filter((o) => o.grupoId === grupo.id)
    .reduce((acc, o) => acc + o.cantidad, 0);
}

export function grupoCompleto(grupo: GrupoOpciones, opciones: OpcionElegida[]): boolean {
  const elegidas = cantidadElegidaEnGrupo(grupo, opciones);
  return elegidas >= grupo.minimo && elegidas <= grupo.maximo;
}

export function opcionesValidas(producto: Producto, opciones: OpcionElegida[]): boolean {
  return (producto.gruposOpciones ?? []).every((g) => grupoCompleto(g, opciones));
}
