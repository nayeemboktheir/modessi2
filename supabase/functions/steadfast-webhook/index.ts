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
// It records the courier outcome and, once Steadfast confirms it, moves the order on:
//   delivered / partial_delivered → status 'delivered'
//   cancelled                     → status 'returned'
// `*_approval_pending` is the rider's word only and changes nothing (see steadfastStatus.ts).
// Only an order still in flight (pending / processing / confirmed / shipped), or one the courier
// moved itself, is changed: a status an admin set by hand is kept and the clash is logged.
// Steadfast correcting itself (delivered → cancelled) is followed; a parcel reopened to pending
// goes back to 'shipped' only if the event is strictly newer than the stored one.
// After a status change, in the background (Steadfast waits only 5 s for an answer):
//   - the 'order_delivered' SMS, under the same admin_settings switches the Orders page uses
//     (sms_enabled + sms_auto_send_status_change); never for partner orders, whose customer
//     belongs to the reseller;
//   - BotBhai, for orders linked there (a no-op otherwise).
// Parcels are matched in `orders` first, then in `wholesale_orders` (wholesale parcels booked
// from /admin/wholesale-prices?tab=orders), by consignment id and then by invoice.
//
// Every request also carries X-Signature: HMAC-SHA256 of the raw body, hex, keyed with the same
// token. When present it must match; it proves the body was not altered, which the bearer token
// alone does not. Steadfast's Idempotency-Key needs no table here: applying the same event twice
// writes the same values, and buildCourierUpdate refuses stale or regressing events.
//
// Steadfast retries on 5xx / timeout but never on 4xx, so:
//   bad token / signature / payload → 401 / 400; unknown consignment or other events → 200;
//   database errors → 500 (worth a retry).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { buildCourierUpdate, safeEqual } from '../_shared/steadfastStatus.ts';
import { botbhaiConfigured, pushOrderStatus } from '../_shared/botbhai.ts';

// deno-lint-ignore no-explicit-any
async function afterStatusChange(supabase: any, orderId: string, status: string) {
  // SMS: delivered only (there is no template for a returned parcel).
  if (status === 'delivered') {
    try {
      const [{ data: settings }, { data: partnerLink }, { data: order }] = await Promise.all([
        supabase.from('admin_settings').select('key, value').in('key', ['sms_enabled', 'sms_auto_send_status_change']),
        supabase.from('partner_order_links').select('order_id').eq('order_id', orderId).maybeSingle(),
        supabase.from('orders').select('order_number, shipping_name, shipping_phone, total, tracking_number').eq('id', orderId).single(),
      ]);
      const on = (key: string) => settings?.find((s: { key: string }) => s.key === key)?.value === 'true';
      if (on('sms_enabled') && on('sms_auto_send_status_change') && !partnerLink && order?.shipping_phone) {
        const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sms`, {
          method: 'POST',
          // Internal call — send-sms authorizes on the service key.
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
          body: JSON.stringify({
            phone: order.shipping_phone,
            template_key: 'order_delivered',
            order_id: orderId,
            variables: {
              customer_name: order.shipping_name,
              order_number: order.order_number,
              total: String(order.total),
              tracking_number: order.tracking_number ?? '',
            },
          }),
        });
        if (!res.ok) console.error(`steadfast-webhook: delivered SMS failed (${res.status})`);
      }
    } catch (err) {
      console.error('steadfast-webhook: delivered SMS failed', err instanceof Error ? err.message : err);
    }
  }

  if (botbhaiConfigured()) {
    try {
      const result = await pushOrderStatus(supabase, orderId);
      if (result.status === 'pushed') console.log(`steadfast-webhook: BotBhai ${result.botbhaiOrderNumber} → ${status}`);
    } catch (err) {
      console.error('steadfast-webhook: BotBhai status push failed', err instanceof Error ? err.message : err);
    }
  }
}

function inBackground(task: Promise<unknown>) {
  // @ts-ignore EdgeRuntime is provided by the Supabase Edge Runtime
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(task);
  else task.catch((err) => console.error('steadfast-webhook: background task failed', err));
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function hmacHex(key: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(body));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

const TABLES = ['orders', 'wholesale_orders'] as const;

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

  const raw = await req.text();
  const signature = (req.headers.get('x-signature') || '').trim().toLowerCase();
  if (signature && !safeEqual(signature, await hmacHex(expected, raw))) {
    console.warn('steadfast-webhook: rejected request with a bad X-Signature');
    return json(401, { status: 'error', message: 'Bad signature' });
  }

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try {
    payload = JSON.parse(raw);
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
  let table: (typeof TABLES)[number] = 'orders';
  lookup: for (const [column, value] of [['steadfast_consignment_id', consignmentId], ['order_number', invoice]] as const) {
    if (!value) continue;
    for (const t of TABLES) {
      const { data, error } = await supabase.from(t).select(columns).eq(column, value).limit(1).maybeSingle();
      if (error) {
        // wholesale_orders without the courier columns (migration 20261117140000 not applied):
        // nothing to record there, but an `orders` failure is worth a retry.
        if (t === 'wholesale_orders') continue;
        console.error('steadfast-webhook: lookup failed', error.message);
        return json(500, { status: 'error', message: 'Lookup failed' });
      }
      if (data) {
        order = data;
        table = t;
        break lookup;
      }
    }
  }
  if (!order) return json(200, { status: 'success', message: 'No matching order' });

  const result = buildCourierUpdate(order, payload, Date.now());
  if (!result.apply) return json(200, { status: 'success', message: `Skipped: ${result.reason}` });

  // Order status follows Steadfast's confirmed outcome, unless an admin already settled it
  // (see nextOrderStatus): then only the courier fields are recorded and the clash is logged.
  const update = { ...result.update };
  const newStatus = typeof update.status === 'string' ? update.status : null;
  if (result.conflict) console.warn(`steadfast-webhook: ${table} ${order.order_number} status kept — ${result.conflict}`);

  const { error: updateError } = await supabase.from(table).update(update).eq('id', order.id);
  if (updateError) {
    console.error('steadfast-webhook: update failed', updateError.message);
    return json(500, { status: 'error', message: 'Update failed' });
  }

  console.log(
    `steadfast-webhook: ${table} ${order.order_number} → ${update.courier_status}${newStatus ? ` (status ${order.status} → ${newStatus})` : ''}`,
  );
  if (newStatus && table === 'orders') inBackground(afterStatusChange(supabase, order.id, newStatus));
  return json(200, { status: 'success', message: 'Webhook received successfully.' });
});
