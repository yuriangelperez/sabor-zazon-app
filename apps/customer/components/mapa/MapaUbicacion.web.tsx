import { useEffect, useMemo, useRef } from 'react';
import type { Punto } from '@sabor/types';
import { colors, radii } from '@sabor/ui';

import { htmlMapa, type MapaUbicacionProps, type MensajeMapa } from './htmlMapa';

// La app no carga los tipos del navegador (DOM): solo lo que se usa acá.
interface EventoMensaje {
  source: unknown;
  data: { mapaSabor?: unknown } | null;
}
const webGlobal = globalThis as unknown as {
  addEventListener: (tipo: 'message', fn: (e: EventoMensaje) => void) => void;
  removeEventListener: (tipo: 'message', fn: (e: EventoMensaje) => void) => void;
};

interface Iframe {
  contentWindow: { postMessage: (datos: unknown, origen: string) => void } | null;
}

// Web: el mapa de Leaflet dentro de un iframe (srcdoc).

export function MapaUbicacion({ centro, irA, local, zoom, onMensaje }: MapaUbicacionProps) {
  const iframe = useRef<Iframe | null>(null);
  // Solo se arma al abrir: después el pin lo mueven el cliente o `irA`.
  const html = useMemo(() => htmlMapa({ centro, local, zoom }), []);
  const avisar = useRef(onMensaje);
  avisar.current = onMensaje;

  const moverA = (p: Punto | null) => {
    if (p) iframe.current?.contentWindow?.postMessage({ moverPin: p }, '*');
  };
  // Último destino pedido, para mandarlo también cuando termina de cargar.
  const destino = useRef(irA);
  destino.current = irA;
  useEffect(() => moverA(irA), [irA?.lat, irA?.lng]);

  useEffect(() => {
    const escuchar = (e: EventoMensaje) => {
      const texto = e.data?.mapaSabor;
      if (e.source !== iframe.current?.contentWindow || typeof texto !== 'string') return;
      try {
        avisar.current(JSON.parse(texto) as MensajeMapa);
      } catch {
        // mensaje ajeno al mapa
      }
    };
    webGlobal.addEventListener('message', escuchar);
    return () => webGlobal.removeEventListener('message', escuchar);
  }, []);

  return (
    <iframe
      ref={iframe as never}
      srcDoc={html}
      onLoad={() => moverA(destino.current)}
      title="Marcá tu casa en el mapa"
      allow="geolocation"
      style={{
        width: '100%',
        height: 320,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radii.sm,
      }}
    />
  );
}
