// Código compartido por las Edge Functions de Mercado Pago (Deno).
// Secretos (Supabase → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN     Access Token de la app de Mercado Pago (APP_USR-… o TEST-…)
//   APP_URL             web de pedidos, ej. https://sabor-zazon-app-rr3c.vercel.app
//   MP_WEBHOOK_SECRET   (opcional) clave secreta de Webhooks para validar la firma
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.

import { createClient } from 'npm:@supabase/supabase-js@2';

const API_MP = 'https://api.mercadopago.com';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

export function secreto(nombre: string): string {
  const valor = Deno.env.get(nombre);
  if (!valor) throw new Error(`Falta el secreto ${nombre} en Supabase (Edge Functions → Secrets).`);
  return valor;
}

// Cliente con la clave de servicio: salta RLS, solo existe en el servidor.
export const db = createClient(secreto('SUPABASE_URL'), secreto('SUPABASE_SERVICE_ROLE_KEY'), {
  db: { schema: 'saborsazon' },
  auth: { persistSession: false },
});

export async function mp<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_MP}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secreto('MP_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Mercado Pago respondió', res.status, JSON.stringify(datos));
    throw new Error(`Mercado Pago respondió ${res.status}`);
  }
  return datos as T;
}

export interface PagoMP {
  id: number;
  status: string;
  external_reference: string | null;
  transaction_amount: number;
  date_created: string;
}

// Estado de Mercado Pago → pago_estado del pedido.
function estadoPedido(status: string): 'pendiente' | 'aprobado' | 'rechazado' | 'reembolsado' {
  switch (status) {
    case 'approved':
      return 'aprobado';
    case 'rejected':
    case 'cancelled':
      return 'rechazado';
    case 'refunded':
    case 'charged_back':
      return 'reembolsado';
    default:
      return 'pendiente'; // pending, in_process, authorized, in_mediation
  }
}

export async function registrarPago(pago: PagoMP): Promise<string | null> {
  if (!pago.external_reference) return null;
  const { data, error } = await db.rpc('registrar_pago_mp', {
    p_pedido: pago.external_reference,
    p_estado: estadoPedido(pago.status),
    p_pago_id: String(pago.id),
    p_monto: pago.transaction_amount,
  });
  if (error) throw error;
  return data as string;
}

// Busca los pagos del pedido en Mercado Pago y registra el mejor (un
// aprobado si hay; si no, el último intento). Sirve de respaldo por si el
// webhook se demora o no está configurado.
export async function sincronizarPedido(pedidoId: string): Promise<void> {
  const { results } = await mp<{ results: PagoMP[] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(pedidoId)}&sort=date_created&criteria=desc&limit=20`
  );
  if (!results?.length) return;
  const aprobado = results.find((p) => p.status === 'approved');
  await registrarPago(aprobado ?? results[0]);
}

// Firma de los webhooks (x-signature: "ts=…,v1=…"). Mercado Pago firma
// "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" con HMAC-SHA256.
export async function firmaValida(req: Request, dataId: string, clave: string): Promise<boolean> {
  const firma = req.headers.get('x-signature') ?? '';
  const requestId = req.headers.get('x-request-id') ?? '';
  const partes = Object.fromEntries(
    firma.split(',').map((p) => p.split('=').map((s) => s.trim()) as [string, string])
  );
  if (!partes.ts || !partes.v1) return false;

  let manifiesto = `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifiesto += `request-id:${requestId};`;
  manifiesto += `ts:${partes.ts};`;

  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(manifiesto)));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === partes.v1;
}
