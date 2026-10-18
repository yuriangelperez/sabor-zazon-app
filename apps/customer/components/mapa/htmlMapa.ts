import type { Punto } from '@sabor/types';

// Página de Leaflet + OpenStreetMap (gratis, sin clave) para que el cliente
// marque su casa con un pin. La usan MapaUbicacion (WebView en el celular)
// y MapaUbicacion.web (iframe en la web). Avisa cada movimiento del pin con
// postMessage: { lat, lng, aviso? } o { error }. Desde afuera se lo mueve con
// window.moverPin(lat, lng) o con postMessage({ moverPin: { lat, lng } }).
export function htmlMapa({ centro, local, zoom }: { centro: Punto; local: Punto | null; zoom: number }): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html, body, #mapa { margin: 0; height: 100%; font-family: sans-serif; }
  .pin { width: 26px; height: 26px; border-radius: 50% 50% 50% 0; background: #e8572a; border: 3px solid #fff;
         transform: rotate(-45deg); box-shadow: 0 2px 6px rgba(0,0,0,.4); }
  .local { width: 14px; height: 14px; border-radius: 50%; background: #222; border: 3px solid #fff;
           box-shadow: 0 1px 4px rgba(0,0,0,.4); }
  #yo { position: absolute; z-index: 1000; right: 10px; bottom: 24px; padding: 8px 12px; border: 0;
        border-radius: 20px; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.35); font-size: 14px; }
</style>
</head>
<body>
<div id="mapa"></div>
<button id="yo" type="button">📍 Estoy acá</button>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var centro = ${JSON.stringify(centro)};
  var local = ${JSON.stringify(local)};
  function enviar(datos) {
    var texto = JSON.stringify(datos);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(texto);
    else window.parent.postMessage({ mapaSabor: texto }, '*');
  }
  var mapa = L.map('mapa').setView([centro.lat, centro.lng], ${zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(mapa);
  if (local) {
    L.marker([local.lat, local.lng], {
      interactive: false,
      icon: L.divIcon({ className: '', html: '<div class="local"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
    }).addTo(mapa).bindTooltip('Sabor y Sazón');
  }
  var pin = L.marker([centro.lat, centro.lng], {
    draggable: true,
    icon: L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [32, 32], iconAnchor: [16, 34] })
  }).addTo(mapa);
  function mover(punto) {
    pin.setLatLng(punto);
    enviar({ lat: punto.lat, lng: punto.lng });
  }
  // La app encontró otra dirección (el cliente la cambió con el mapa abierto).
  window.moverPin = function (lat, lng) {
    var punto = L.latLng(lat, lng);
    pin.setLatLng(punto);
    mapa.setView(punto, 17);
  };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.moverPin) window.moverPin(d.moverPin.lat, d.moverPin.lng);
  });
  pin.on('dragend', function () { mover(pin.getLatLng()); });
  mapa.on('click', function (e) { mover(e.latlng); });
  document.getElementById('yo').onclick = function () {
    if (!navigator.geolocation) return enviar({ error: 'Tu dispositivo no comparte la ubicación: mové el pin a mano.' });
    navigator.geolocation.getCurrentPosition(
      function (p) {
        var punto = L.latLng(p.coords.latitude, p.coords.longitude);
        var metros = Math.round(p.coords.accuracy || 0);
        pin.setLatLng(punto);
        // Una computadora no tiene GPS: estima por WiFi o IP y puede errar
        // por kilómetros. En ese caso se avisa en vez de dar el punto por bueno.
        if (metros > 100) {
          mapa.setView(punto, metros > 1000 ? 14 : 16);
          enviar({ lat: punto.lat, lng: punto.lng,
                   aviso: 'Tu ubicación es aproximada (±' + (metros >= 1000 ? (metros / 1000).toFixed(1) + ' km' : metros + ' m') +
                          '). Mové el pin hasta tu casa.' });
        } else {
          mapa.setView(punto, 18);
          enviar({ lat: punto.lat, lng: punto.lng });
        }
      },
      function () { enviar({ error: 'No pudimos obtener tu ubicación: mové el pin a mano.' }); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
</script>
</body>
</html>`;
}

export type MensajeMapa = { lat: number; lng: number; aviso?: string } | { error: string };

export interface MapaUbicacionProps {
  centro: Punto;
  irA: Punto | null; // al cambiar, el mapa y el pin se mueven ahí (sin recargar)
  local: Punto | null;
  zoom: number;
  onMensaje: (mensaje: MensajeMapa) => void;
}
