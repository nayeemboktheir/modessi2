// botbhai-webhook: receives BotBhai's signed order webhooks (BotBhai → Integrations →
// REST API → Webhooks), so chatbot orders and status changes reach Modessi without
// anyone pressing "Import".
//
//   order.created         a BotBhai order we have not seen is imported as
//                         order_source 'botbhai' (in the background, see below),
//                         while admin_settings.botbhai_auto_sync is 'true'
//   order.status_changed  the linked Modessi order is set to the new status
//   ping                  "Send test" — answered 200
//
// This function is public: BotBhai sends no JWT, so it must be listed in the
// FUNCTIONS_NO_VERIFY_JWT env var on the edge-functions container. Its only gate is
// the HMAC signature, checked against BOTBHAI_WEBHOOK_SECRET before anything else.
// Each X-BotBhai-Delivery id is claimed in botbhai_webhook_deliveries so retries are
// ignored; a failure releases the claim and answers 500 so BotBhai retries.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import {
  BotbhaiError,
  applyRemoteStatus,
  botbhaiConfigured,
  importOne,
  pushStock,
  botbhaiAutoSyncEnabled,
  remoteOrderStatus,
} from '../_shared/botbhai.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

// Reject signatures older (or newer) than this, so a captured request can't be replayed.
const MAX_SIGNATURE_AGE_SECONDS = 300;
// An order.created for an order we pushed can arrive before pushOrder has written
// its link row. Wait this long before deciding the order is new to us.
const IMPORT_SETTLE_SECONDS = 30;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const sleep = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** X-BotBhai-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.rawBody">. */
async function signatureValid(header: string, rawBody: string, secret: string): Promise<boolean> {
  const t = header.match(/(?:^|,)\s*t=(\d+)/)?.[1];
  const v1 = header.match(/(?:^|,)\s*v1=([0-9a-f]+)/i)?.[1]?.toLowerCase();
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > MAX_SIGNATURE_AGE_SECONDS) return false;

  return constantTimeEqual(v1, await hmacHex(secret, `${t}.${rawBody}`));
}

async function isLinked(supabase: SupabaseClient, botbhaiOrderNumber: string): Promise<boolean> {
  const { data } = await supabase
    .from('botbhai_order_links')
    .select('order_id')
    .eq('botbhai_order_number', botbhaiOrderNumber)
    .maybeSingle();
  return !!data;
}

/** Import a BotBhai order, bring it to BotBhai's current status, and push the new stock back. */
async function importAndSettle(supabase: SupabaseClient, botbhaiOrderNumber: string): Promise<void> {
  const imported = await importOne(supabase, botbhaiOrderNumber);
  if (!imported) return;
  console.log(`botbhai-webhook: imported BotBhai ${botbhaiOrderNumber} as #${imported.orderNumber}`);

  // importOne creates the order as pending; the chatbot may already have confirmed it.
  const current = await remoteOrderStatus(botbhaiOrderNumber);
  if (current && current !== 'pending') await applyRemoteStatus(supabase, botbhaiOrderNumber, current);

  // Only reached with auto-sync on, so push the stock this order took.
  const stock = await pushStock(supabase, imported.productIds, imported.variationIds);
  if (stock.errors.length > 0) console.warn('botbhai-webhook: stock push errors:', JSON.stringify(stock.errors));
}

async function handleOrderCreated(supabase: SupabaseClient, botbhaiOrderNumber: string): Promise<void> {
  if (!(await botbhaiAutoSyncEnabled(supabase))) return;
  await sleep(IMPORT_SETTLE_SECONDS);
  // Orders we pushed from the website, or already imported, are linked by now.
  if (await isLinked(supabase, botbhaiOrderNumber)) return;
  await importAndSettle(supabase, botbhaiOrderNumber);
}

async function handleStatusChanged(
  supabase: SupabaseClient,
  botbhaiOrderNumber: string,
  status: string,
): Promise<string> {
  if (!(await isLinked(supabase, botbhaiOrderNumber))) {
    // order.created never reached us (or came before this endpoint existed).
    if (status !== 'pending' && status !== 'confirmed') return 'not linked; ignored';
    if (!(await botbhaiAutoSyncEnabled(supabase))) return 'not linked; auto-sync is off';
    await importAndSettle(supabase, botbhaiOrderNumber);
    return 'imported';
  }

  // Deliveries can arrive late or out of order, and pushing a status from here walks
  // BotBhai through every intermediate step, each announced by its own webhook.
  // Only act on the status BotBhai holds now, never on a stale step.
  const current = await remoteOrderStatus(botbhaiOrderNumber);
  if (current && current !== status) return `stale (BotBhai is now ${current}); ignored`;

  const result = await applyRemoteStatus(supabase, botbhaiOrderNumber, status);
  return result.status === 'updated' ? `${result.from} -> ${result.to}` : result.reason;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('BOTBHAI_WEBHOOK_SECRET');
  if (!secret) {
    console.error('botbhai-webhook: BOTBHAI_WEBHOOK_SECRET is not set');
    return json({ error: 'Webhook not configured' }, 503);
  }

  const rawBody = await req.text();
  if (!(await signatureValid(req.headers.get('x-botbhai-signature') ?? '', rawBody, secret))) {
    return json({ error: 'Invalid signature' }, 401);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const eventType = String(req.headers.get('x-botbhai-event') ?? event?.event ?? '');
  const deliveryId = String(req.headers.get('x-botbhai-delivery') ?? event?.id ?? '');
  const orderNumber = event?.data?.order_number ? String(event.data.order_number) : null;

  if (eventType === 'ping') return json({ ok: true, pong: true });
  if (!deliveryId) return json({ error: 'Missing X-BotBhai-Delivery' }, 400);

  if (eventType !== 'order.created' && eventType !== 'order.status_changed') {
    return json({ ok: true, ignored: `unhandled event ${eventType}` });
  }
  if (!orderNumber) return json({ error: 'Missing data.order_number' }, 400);

  if (!botbhaiConfigured()) {
    // We can't look the order up without the API key. Answer non-2xx so BotBhai keeps
    // the delivery and retries once the key is set.
    console.error('botbhai-webhook: BOTBHAI_API_KEY is not set');
    return json({ error: 'BotBhai API key not configured' }, 503);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: claimError } = await supabase
    .from('botbhai_webhook_deliveries')
    .insert({ delivery_id: deliveryId, event: eventType, order_number: orderNumber });
  if (claimError) {
    if (claimError.code === '23505') return json({ ok: true, duplicate: true });
    console.error('botbhai-webhook: could not record delivery:', claimError.message);
    return json({ error: 'Could not record delivery' }, 500);
  }

  const release = () => supabase.from('botbhai_webhook_deliveries').delete().eq('delivery_id', deliveryId);

  if (eventType === 'order.created') {
    // Importing waits out IMPORT_SETTLE_SECONDS, longer than BotBhai's 10s deadline,
    // so answer now and import afterwards. If that fails, the delivery is released
    // and the admin page's "Import BotBhai orders" button picks the order up.
    const work = handleOrderCreated(supabase, orderNumber).catch(async (err) => {
      console.error(`botbhai-webhook: import of ${orderNumber} failed:`, (err as Error)?.message ?? err);
      await release();
    });
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work);
    else await work;
    return json({ ok: true, queued: true });
  }

  try {
    const outcome = await handleStatusChanged(supabase, orderNumber, String(event?.data?.status ?? ''));
    console.log(`botbhai-webhook: ${orderNumber} ${event?.data?.status}: ${outcome}`);
    return json({ ok: true, outcome });
  } catch (err) {
    await release();
    const message = err instanceof BotbhaiError ? `BotBhai ${err.status} ${err.code}: ${err.message}` : (err as Error)?.message;
    console.error(`botbhai-webhook: ${orderNumber} status change failed:`, message);
    return json({ error: 'Processing failed' }, 500);
  }
});
