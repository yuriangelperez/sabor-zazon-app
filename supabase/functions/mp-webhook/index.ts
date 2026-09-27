// Mercado Pago avisa acá cada cambio de un pago. No se confía en el cuerpo
// del aviso: se consulta el pago en Mercado Pago con el Access Token y
// recién ahí se actualiza el pedido.
// Deploy: npx supabase functions deploy mp-webhook --no-verify-jwt

import { firmaValida, mp, registrarPago, respuesta, type PagoMP } from '../_shared/mercadopago.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return respuesta({ ok: true });

  const url = new URL(req.url);
  const cuerpo = await req.json().catch(() => ({}));
  const tipo = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? cuerpo.type ?? cuerpo.topic;
  const pagoId = url.searchParams.get('data.id') ?? cuerpo.data?.id ?? url.searchParams.get('id');

  // Solo interesan los pagos (Mercado Pago también avisa merchant_orders, etc.).
  if (tipo !== 'payment' || !pagoId) return respuesta({ ok: true, ignorado: true });

  // Si hay clave y el aviso viene firmado, la firma tiene que ser válida.
  // (Igual el pago se consulta siempre en Mercado Pago, así que un aviso
  // falso no puede aprobar nada.)
  const clave = Deno.env.get('MP_WEBHOOK_SECRET');
  if (clave && req.headers.has('x-signature') && !(await firmaValida(req, String(pagoId), clave))) {
    console.warn('Webhook con firma inválida', pagoId);
    return respuesta({ error: 'Firma inválida.' }, 401);
  }

  try {
    const pago = await mp<PagoMP>(`/v1/payments/${encodeURIComponent(String(pagoId))}`);
    const resultado = await registrarPago(pago);
    console.log(`Pago ${pago.id} (${pago.status}) del pedido ${pago.external_reference}: ${resultado}`);
    return respuesta({ ok: true });
  } catch (err) {
    // 500 hace que Mercado Pago reintente más tarde.
    console.error(err);
    return respuesta({ error: 'No se pudo procesar el aviso.' }, 500);
  }
});
