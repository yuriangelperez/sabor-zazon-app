import { useEffect, useState } from 'react';
import type { Producto } from '@sabor/types';
import { getIngredientes, getProductoById, mensajeError } from '@sabor/api-client';
import { aplicarIngredientesAgotados, estaDisponible } from '@sabor/utils';

export function useProducto(id: string | undefined) {
  const [producto, setProducto] = useState<Producto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);

    Promise.all([getProductoById(id ?? ''), getIngredientes()])
      .then(([p, ingredientes]) => {
        if (cancelado) return;
        const conStock = p ? aplicarIngredientesAgotados([p], ingredientes)[0] : null;
        // Un producto pausado se trata como inexistente para el cliente.
        setProducto(conStock && estaDisponible(conStock) ? conStock : null);
      })
      .catch((err) => {
        if (!cancelado) setError(mensajeError(err, 'No se pudo cargar el producto.'));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [id]);

  return { producto, cargando, error };
}
