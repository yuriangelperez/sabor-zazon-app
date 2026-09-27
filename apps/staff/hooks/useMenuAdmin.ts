import { useCallback, useEffect, useState } from 'react';
import type { Ingrediente, Producto } from '@sabor/types';
import { getIngredientes, getProductos, mensajeError, suscribirMenu } from '@sabor/api-client';
import { aplicarIngredientesAgotados } from '@sabor/utils';

// Todo el menú (incluso lo desactivado) con los ingredientes agotados
// aplicados, actualizado en tiempo real.
export function useMenuAdmin() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [todos, ing] = await Promise.all([getProductos(), getIngredientes()]);
      setIngredientes(ing);
      setProductos(aplicarIngredientesAgotados(todos, ing));
      setError(null);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar el menú.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    return suscribirMenu(() => void cargar());
  }, [cargar]);

  return { productos, ingredientes, cargando, error, recargar: cargar };
}
