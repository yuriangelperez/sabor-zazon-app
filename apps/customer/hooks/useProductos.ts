import { useCallback, useEffect, useState } from 'react';
import type { Producto } from '@sabor/types';
import { getIngredientes, getProductos, mensajeError, suscribirMenu } from '@sabor/api-client';
import { aplicarIngredientesAgotados, estaDisponible } from '@sabor/utils';

interface UseProductosResult {
  productos: Producto[];
  cargando: boolean;
  error: string | null;
  refrescar: () => Promise<void>;
}

// Menú del cliente: solo lo disponible, con los ingredientes agotados
// aplicados. Se actualiza solo cuando recepción cambia algo (tiempo real).
export function useProductos(): UseProductosResult {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      setError(null);
      const [todos, ingredientes] = await Promise.all([getProductos(), getIngredientes()]);
      setProductos(aplicarIngredientesAgotados(todos, ingredientes).filter((p) => estaDisponible(p)));
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar el menú.'));
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    return suscribirMenu(() => void cargar(true));
  }, [cargar]);

  return { productos, cargando, error, refrescar: () => cargar() };
}
