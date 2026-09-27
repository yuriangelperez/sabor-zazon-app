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
  const [estados, setEstados] = useState<Record<string, SeguimientoPedido | null>>({});
  const [cargando, setCargando] = useState(guardados.length > 0);

  const cargar = useCallback(async () => {
    if (guardados.length === 0) {
      setCargando(false);
      return;
    }
    const resultados = await Promise.all(
      guardados.map(async (p) => {
        try {
          return [p.id, await verPedido(p.id, p.codigo)] as const;
        } catch {
          return [p.id, null] as const;
        }
      })
    );
    setEstados(Object.fromEntries(resultados));
    setCargando(false);
  }, [guardados]);

  useEffect(() => {
    void cargar();
    const intervalo = setInterval(() => void cargar(), INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  const pedidos: MiPedido[] = guardados.map((p) => ({ ...p, seguimiento: estados[p.id] ?? null }));
  return { pedidos, enCurso: pedidos.filter(pedidoEnCurso), cargando, refrescar: cargar };
}
