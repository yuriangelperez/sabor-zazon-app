import { useCallback, useState } from 'react';
import { Linking, Platform } from 'react-native';
import type { PagoEstado } from '@sabor/types';
import { iniciarPagoMercadoPago, mensajeError, verificarPagoMercadoPago } from '@sabor/api-client';

// Lleva al cliente a pagar a Mercado Pago. En la web se va en la misma
// pestaña (y Mercado Pago lo trae de vuelta al seguimiento); en la app se
// abre el navegador.
export async function abrirPagoMercadoPago(id: string, codigo: string): Promise<void> {
  const url = await iniciarPagoMercadoPago(id, codigo);
  if (Platform.OS === 'web') {
    // Misma pestaña (Linking.openURL en la web abre una nueva).
    (globalThis as unknown as { location: { assign: (u: string) => void } }).location.assign(url);
  } else await Linking.openURL(url);
}

export function usePagoMercadoPago(id: string | undefined, codigo: string | undefined) {
  const [abriendo, setAbriendo] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pagar = useCallback(async () => {
    if (!id || !codigo) return;
    setAbriendo(true);
    setError(null);
    try {
      await abrirPagoMercadoPago(id, codigo);
    } catch (err) {
      setError(mensajeError(err, 'No pudimos abrir Mercado Pago. Probá de nuevo.'));
    } finally {
      // En la web la página se va; si no se fue (error), se habilita el botón.
      setAbriendo(false);
    }
  }, [id, codigo]);

  const verificar = useCallback(
    async (silencioso = false): Promise<PagoEstado | null> => {
      if (!id || !codigo) return null;
      setVerificando(true);
      if (!silencioso) setError(null);
      try {
        return await verificarPagoMercadoPago(id, codigo);
      } catch (err) {
        if (!silencioso) setError(mensajeError(err, 'No pudimos consultar el pago. Probá de nuevo.'));
        return null;
      } finally {
        setVerificando(false);
      }
    },
    [id, codigo]
  );

  return { pagar, verificar, abriendo, verificando, error };
}
