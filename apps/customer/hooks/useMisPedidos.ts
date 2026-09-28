import { useCallback, useEffect, useState } from 'react';
import type { EstadoPedido } from '@sabor/types';
import { verPedido, type SeguimientoPedido } from '@sabor/api-client';

import { usePedidosStore, type PedidoGuardado } from '../stores/usePedidosStore';

const INTERVALO_MS = 20_000;
const ESTADOS_FINALES: EstadoPedido[] = ['entregado', 'cancelado', 'rechazado'];

export interface MiPedido extends PedidoGuardado {
  seguimiento: SeguimientoPedido | null; // null mientras carga o si ya no existe
}

export function pedidoEnCurso(p: MiPedido): boolean {
  return p.seguimiento != null && !ESTADOS_FINALES.includes(p.seguimiento.estado);
}

// Pedidos hechos desde este dispositivo con su estado actual (RF-07).
// Consulta cada pedido con su código de seguimiento y se refresca solo.
export function useMisPedidos() {
  const guardados = usePedidosStore((s) => s.pedidos);
  const quitarPedidos = usePedidosStore((s) => s.quitarPedidos);
  const [estados, setEstados] = useState<Record<string, SeguimientoPedido | null>>({});
  const [cargando, setCargando] = useState(guardados.length > 0);

  const cargar = useCallback(async () => {
    if (guardados.length === 0) {
      setCargando(false);
      return;
    }
    // undefined = no se pudo consultar (sin conexión): queda en "Sin estado".
    // null = la base respondió que no existe: se saca de la lista.
    const resultados = await Promise.all(
      guardados.map(async (p) => {
        try {
          return [p.id, await verPedido(p.id, p.codigo)] as const;
        } catch {
          return [p.id, undefined] as const;
        }
      })
    );
    const inexistentes = resultados.filter(([, s]) => s === null).map(([id]) => id);
    if (inexistentes.length > 0) quitarPedidos(inexistentes);
    setEstados(Object.fromEntries(resultados.filter(([, s]) => s != null)) as Record<string, SeguimientoPedido>);
    setCargando(false);
  }, [guardados, quitarPedidos]);

  useEffect(() => {
    void cargar();
    const intervalo = setInterval(() => void cargar(), INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  const pedidos: MiPedido[] = guardados.map((p) => ({ ...p, seguimiento: estados[p.id] ?? null }));
  return { pedidos, enCurso: pedidos.filter(pedidoEnCurso), cargando, refrescar: cargar };
}
