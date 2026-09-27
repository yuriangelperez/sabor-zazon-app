// Configuración de la landing.
//
// URL_PEDIDOS: dirección donde está publicada la web de pedidos (apps/customer).
// - En desarrollo, `npm run customer:web` la levanta en http://localhost:8081
// - Cuando la publiques (Vercel, etc.), reemplazá esta URL por la definitiva.
//
// Los botones de cada producto llevan a `${URL_PEDIDOS}/producto/<id>` y los
// botones generales a `${URL_PEDIDOS}/menu`.
window.SABOR_CONFIG = {
    URL_PEDIDOS: 'https://sabor-zazon-app-rr3c.vercel.app',
    HORARIO: { apertura: '10:00', cierre: '22:00' },
};
