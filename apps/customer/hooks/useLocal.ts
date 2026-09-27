import { useCallback, useEffect, useState } from 'react';
import type { ConfiguracionLocal } from '@sabor/types';
import { getConfiguracion, suscribirConfiguracion } from '@sabor/api-client';
import { localAbierto } from '@sabor/utils';

// Estado del local (RF-07 / RF-13): abierto según horario y pausa manual.
// Se actualiza al instante si recepción "cierra la tienda", y el cierre
// manual vence solo en la próxima apertura.
export function useLocal() {
  const [config, setConfig] = useState<ConfiguracionLocal | null>(null);
  const [, setTic] = useState(0);

  const cargar = useCallback(() => {
    getConfiguracion()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    cargar();
    const desuscribir = suscribirConfiguracion(cargar);
    // Recalcula cada minuto para abrir/cerrar justo a la hora.
    const intervalo = setInterval(() => setTic((t) => t + 1), 60_000);
    return () => {
      desuscribir();
      clearInterval(intervalo);
    };
  }, [cargar]);

  const abierto = config != null && localAbierto(config);

  return { config, abierto, cargando: config == null };
}
