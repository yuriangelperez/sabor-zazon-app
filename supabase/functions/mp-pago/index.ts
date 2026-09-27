// POST { accion: 'crear' | 'verificar', id, codigo }
// - crear: arma el pago en Mercado Pago (Checkout Pro) y devuelve { url }
//   para mandar al cliente a pagar.
// - verificar: consulta en Mercado Pago si el pedido ya se pagó y devuelve
//   { pagoEstado }. Se usa al volver de Mercado Pago y con "Ya pagué".
// El cliente se identifica con el id y el código de seguimiento del pedido.
// Deploy: npx supabase functions deploy mp-pago --no-verify-jwt

import { cors, db, mp, respuesta, secreto, sincronizarPedido } from '../_shared/mercadopago.ts';

interface Pedido {
  id: string;
  numero: number;
  total: number;
  nombre_cliente: string;
  codigo_seguimiento: string;
  metodo_pago: string;
  pago_estado: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido.' }, 405);

  try {
    const { accion, id, codigo } = await req.json().catch(() => ({}));
    if (typeof id !== 'string' || typeof codigo !== 'string' || !id || !codigo) {
      return respuesta({ error: 'Pedido inválido.' }, 400);
    }

    const { data: pedido } = await db
      .from('pedidos')
      .select('id, numero, total, nombre_cliente, codigo_seguimiento, metodo_pago, pago_estado')
      .eq('id', id)
      .eq('codigo_seguimiento', codigo)
      .maybeSingle<Pedido>();
    if (!pedido) return respuesta({ error: 'No encontramos este pedido.' }, 404);
    if (pedido.pago_estado === 'no_aplica') {
      return respuesta({ error: 'Este pedido no se paga con Mercado Pago.' }, 400);
    }

    if (accion === 'verificar') {
      if (pedido.pago_estado !== 'aprobado') await sincronizarPedido(pedido.id);
      const { data } = await db.from('pedidos').select('pago_estado').eq('id', pedido.id).single();
      return respuesta({ pagoEstado: data?.pago_estado ?? pedido.pago_estado });
    }

    if (accion !== 'crear') return respuesta({ error: 'Acción inválida.' }, 400);
    if (pedido.pago_estado === 'aprobado') return respuesta({ error: 'Este pedido ya está pagado.' }, 409);

    const appUrl = secreto('APP_URL').replace(/\/$/, '');
    const volver = `${appUrl}/pedido/${pedido.id}?c=${encodeURIComponent(pedido.codigo_seguimiento)}&mp=1`;
    const numero = `#${String(pedido.numero).padStart(4, '0')}`;
    const vence = new Date(Date.now() + 60 * 60 * 1000); // 1 hora para pagar

    const preferencia = await mp<{ id: string; init_point: string }>('/checkout/preferences', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        items: [
          {
            id: pedido.id,
            title: `Pedido ${numero} · Sabor y Sazón`,
            quantity: 1,
            currency_id: 'ARS',
            unit_price: pedido.total,
          },
        ],
        payer: { name: pedido.nombre_cliente },
        external_reference: pedido.id,
        back_urls: { success: volver, pending: volver, failure: volver },
        auto_return: 'approved',
        notification_url: `${secreto('SUPABASE_URL')}/functions/v1/mp-webhook`,
        statement_descriptor: 'SABORYSAZON',
        // Solo aprobado o rechazado al momento (sin pagos "en revisión"),
        // y sin medios en efectivo (Rapipago, Pago Fácil): es comida.
        binary_mode: true,
        payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: vence.toISOString(),
      }),
    });

    await db.from('pedidos').update({ mp_preferencia_id: preferencia.id }).eq('id', pedido.id);
    return respuesta({ url: preferencia.init_point });
  } catch (err) {
    console.error(err);
    return respuesta({ error: 'No pudimos conectar con Mercado Pago. Probá de nuevo en unos minutos.' }, 502);
  }
});
