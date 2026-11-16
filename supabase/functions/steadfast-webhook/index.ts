// steadfast-webhook: receives Steadfast delivery-status webhooks and records the parcel's
// outcome on the order (courier_status, cash collected, Steadfast's delivery charge).
// Reseller settlement (partner-api, Admin → Partner Orders) is worked out from these.
//
// Setup (Steadfast merchant panel → Webhook):
//   Callback URL: https://<modessi supabase host>/functions/v1/steadfast-webhook
//   Auth token:   a long random string, saved as admin_settings.steadfast_webhook_token
//                 (or the STEADFAST_WEBHOOK_TOKEN env var)
// Steadfast sends no Supabase JWT, so this function must be listed in FUNCTIONS_NO_VERIFY_JWT
// on the edge-functions container; the bearer token check below replaces it.
//
// It only records the courier outcome: the order's own status is left for the admin, as before.
//
// Steadfast retries on 5xx / timeout but never on 4xx, so:
//   bad token / payload → 401 / 400; unknown consignment or other events → 200;
//   database errors → 500 (worth a retry).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { buildCourierUpdate, safeEqual } from '../_shared/steadfastStatus.ts';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
async function getWebhookToken(supabase: any): Promise<string> {
  const { data } = await supabase.from('admin_settings').select('value').eq('key', 'steadfast_webhook_token').maybeSingle();
  return String(data?.value || Deno.env.get('STEADFAST_WEBHOOK_TOKEN') || '').trim();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { status: 'error', message: 'Method not allowed' });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const expected = await getWebhookToken(supabase);
  const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!expected || expected.length < 16 || !provided || !safeEqual(provided, expected)) {
    console.warn('steadfast-webhook: rejected request with missing or wrong token');
    return json(401, { status: 'error', message: 'Unauthorized' });
  }

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { status: 'error', message: 'Invalid JSON' });
  }

  const type = String(payload?.notification_type || 'delivery_status').toLowerCase();
  if (type !== 'delivery_status') return json(200, { status: 'success', message: `Ignored ${type}` });

  const consignmentId = payload?.consignment_id != null ? String(payload.consignment_id).trim() : '';
  const invoice = payload?.invoice != null ? String(payload.invoice).trim() : '';
  if (!consignmentId && !invoice) return json(400, { status: 'error', message: 'consignment_id or invoice is required' });

  const columns = 'id, order_number, status, courier_status, courier_status_updated_at';
  let order = null;
  for (const [column, value] of [['steadfast_consignment_id', consignmentId], ['order_number', invoice]] as const) {
    if (order || !value) continue;
    const { data, error } = await supabase.from('orders').select(columns).eq(column, value).limit(1).maybeSingle();
    if (error) {
      console.error('steadfast-webhook: lookup failed', error.message);
      return json(500, { status: 'error', message: 'Lookup failed' });
    }
    order = data;
  }
  if (!order) return json(200, { status: 'success', message: 'No matching order' });

  const result = buildCourierUpdate(order, payload, Date.now());
  if (!result.apply) return json(200, { status: 'success', message: `Skipped: ${result.reason}` });

  // Courier fields only; the order's status stays the admin's call.
  const { status: _ignored, ...update } = result.update;
  const { error: updateError } = await supabase.from('orders').update(update).eq('id', order.id);
  if (updateError) {
    console.error('steadfast-webhook: update failed', updateError.message);
    return json(500, { status: 'error', message: 'Update failed' });
  }

  console.log(`steadfast-webhook: ${order.order_number} → ${update.courier_status}`);
  return json(200, { status: 'success', message: 'Webhook received successfully.' });
});
