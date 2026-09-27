// Configuración de la landing.
//
// URL_PEDIDOS: dirección donde está publicada la web de pedidos (apps/customer).
// - En desarrollo, `npm run customer:web` la levanta en http://localhost:8081
// - Cuando la publiques (Vercel, etc.), reemplazá esta URL por la definitiva.
//
// Los botones de cada producto llevan a `${URL_PEDIDOS}/producto/<id>` y los
// botones generales a `${URL_PEDIDOS}/menu`.
//
// SUPABASE_*: para mostrar el horario y si el local está abierto tal como lo
// configura recepción. La clave "publishable" es pública por diseño (la
// misma que usa la web de pedidos); solo permite lo que habilita RLS.
// HORARIO: respaldo si no se puede consultar Supabase.
window.SABOR_CONFIG = {
    URL_PEDIDOS: 'https://sabor-zazon-app-rr3c.vercel.app',
    SUPABASE_URL: 'https://mpjtxylzmoubywznqdqr.supabase.co',
    SUPABASE_KEY: 'sb_publishable_YBP_JstlELZAfDkRuWj3zw_1KHZQsm6',
    HORARIO: { apertura: '10:00', cierre: '22:00' },
};
