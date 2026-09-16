import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAdmin } from '../_shared/auth.ts';
import {
  getSteadfastCredentials,
  hasSteadfastCredentials,
  requestSteadfast,
  upstreamMessage,
} from '../_shared/steadfast.ts';

interface SteadfastOrderRequest {
  orderId?: string;
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  alternative_phone?: string;
  recipient_email?: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
  item_description?: string;
  total_lot?: number;
  delivery_type?: 0 | 1;
}

interface UpstreamConsignment {
  consignment_id?: string | number;
  tracking_code?: string;
}

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function validateOrder(order: SteadfastOrderRequest): string | null {
  if (!order || typeof order !== 'object') return 'Order payload is required';
  if (!String(order.invoice ?? '').trim()) return 'Invoice is required';
  if (!String(order.recipient_name ?? '').trim()) return 'Recipient name is required';
  if (!String(order.recipient_phone ?? '').trim()) return 'Recipient phone is required';
  if (!String(order.recipient_address ?? '').trim()) return 'Recipient address is required';
  if (!Number.isFinite(Number(order.cod_amount)) || Number(order.cod_amount) < 0) {
    return 'COD amount must be a non-negative number';
  }
  if (order.delivery_type !== undefined && order.delivery_type !== 0 && order.delivery_type !== 1) {
    return 'Delivery type must be 0 (home) or 1 (hub pickup)';
  }
  return null;
}

function toSteadfastPayload(order: SteadfastOrderRequest) {
  // Do not forward our local order ID. Every other field maps directly to the
  // documented Steadfast create-order payload.
  return {
    invoice: String(order.invoice).trim(),
    recipient_name: String(order.recipient_name).trim(),
    recipient_phone: String(order.recipient_phone).trim(),
    ...(order.alternative_phone?.trim() ? { alternative_phone: order.alternative_phone.trim() } : {}),
    ...(order.recipient_email?.trim() ? { recipient_email: order.recipient_email.trim() } : {}),
    recipient_address: String(order.recipient_address).trim(),
    cod_amount: Number(order.cod_amount),
    ...(order.note?.trim() ? { note: order.note.trim() } : {}),
    ...(order.item_description?.trim() ? { item_description: order.item_description.trim() } : {}),
    ...(order.total_lot !== undefined ? { total_lot: Number(order.total_lot) } : {}),
    ...(order.delivery_type !== undefined ? { delivery_type: order.delivery_type } : {}),
  };
}

async function findAlreadyDispatched(
  supabase: { from: (table: string) => any },
  orderIds: string[],
): Promise<Map<string, string>> {
  const ids = orderIds.filter(Boolean);
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from('orders')
    .select('id, tracking_number')
    .in('id', ids)
    .not('tracking_number', 'is', null);

  if (error) {
    console.error('Could not check existing consignments:', error.message);
    return new Map();
  }

  return new Map(
    (data ?? [])
      .filter((row: { tracking_number: string | null }) => Boolean(row.tracking_number))
      .map((row: { id: string; tracking_number: string }) => [row.id, row.tracking_number]),
  );
}

async function saveConsignment(
  supabase: { from: (table: string) => any },
  orderId: string | undefined,
  consignment: UpstreamConsignment | undefined,
) {
  if (!orderId || !consignment) return;
  const consignmentId = consignment.consignment_id ? String(consignment.consignment_id) : undefined;
  const trackingCode = consignment.tracking_code ?? consignmentId;
  if (!trackingCode) return;

  const { error } = await supabase
    .from('orders')
    .update({
      tracking_number: trackingCode,
      steadfast_consignment_id: consignmentId ?? trackingCode,
      status: 'processing',
    })
    .eq('id', orderId);

  if (error) console.error(`Could not save Steadfast consignment for order ${orderId}:`, error.message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const credentials = await getSteadfastCredentials(supabase);
    if (!hasSteadfastCredentials(credentials)) {
      return json({ error: 'Steadfast credentials not configured. Please add them in Admin → Steadfast settings.' }, 500);
    }

    const body = await req.json();
    const order = body as SteadfastOrderRequest;
    const validationError = validateOrder(order);
    if (validationError) return json({ error: validationError }, 400);

    if (order.orderId) {
      const existing = (await findAlreadyDispatched(supabase, [order.orderId])).get(order.orderId);
      if (existing) {
        return json({
          success: true,
          alreadyDispatched: true,
          message: 'Order was already sent to Steadfast',
          consignment_id: existing,
          tracking_code: existing,
        }, 200);
      }
    }

    const upstream = await requestSteadfast('/create_order', credentials, {
      method: 'POST',
      body: JSON.stringify(toSteadfastPayload(order)),
    });
    const response = upstream.data as { status?: number; consignment?: UpstreamConsignment } | undefined;
    const successful = upstream.ok && response?.status === 200 && Boolean(response.consignment);

    if (!successful) {
      return json({
        error: upstreamMessage(upstream.data, 'Failed to create Steadfast order'),
        details: upstream.data,
      }, upstream.ok ? 400 : 502);
    }

    await saveConsignment(supabase, order.orderId, response.consignment);
    return json({
      success: true,
      message: 'Order sent to Steadfast successfully',
      consignment_id: response.consignment?.consignment_id,
      tracking_code: response.consignment?.tracking_code,
      data: upstream.data,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('steadfast-courier failed:', message);
    return json({ error: message }, 500);
  }
});
