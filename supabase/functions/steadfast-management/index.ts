import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAdmin } from '../_shared/auth.ts';
import {
  getSteadfastCredentials,
  hasSteadfastCredentials,
  requestSteadfast,
  upstreamMessage,
} from '../_shared/steadfast.ts';

type ManagementAction =
  | 'get_balance'
  | 'create_return_request'
  | 'get_return_request'
  | 'get_return_requests'
  | 'get_payments'
  | 'get_payment'
  | 'get_police_stations'
  | 'backfill_tracking_links'
  | 'sync_returns';

interface ManagementRequest {
  action: ManagementAction;
  consignment_id?: string | number;
  invoice?: string;
  tracking_code?: string;
  reason?: string;
  return_request_id?: string | number;
  payment_id?: string | number;
}

const actions = new Set<ManagementAction>([
  'get_balance',
  'create_return_request',
  'get_return_request',
  'get_return_requests',
  'get_payments',
  'get_payment',
  'get_police_stations',
  'backfill_tracking_links',
  'sync_returns',
]);

type Credentials = Awaited<ReturnType<typeof getSteadfastCredentials>>;
// deno-lint-ignore no-explicit-any
type Db = any;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Parcels booked before steadfast-courier kept Steadfast's tracking_link have only the code.
// /parcel_states/{state} returns each parcel with the same fields create_order does, link
// included, so read every page of the states a parcel can still be in and fill the gaps.
// Finished parcels (delivered / cancelled) are not listed there; they keep the fallback link.
async function backfillTrackingLinks(supabase: Db, credentials: Credentials) {
  const links = new Map<string, string>();
  const failures: string[] = [];
  for (const state of ['in_review', 'delivery_processing', 'cod_processing']) {
    for (let page = 1; page <= 20; page++) {
      const upstream = await requestSteadfast(`/parcel_states/${state}?per_page=100&page=${page}`, credentials);
      // deno-lint-ignore no-explicit-any
      const body = upstream.data as any;
      if (!upstream.ok) {
        failures.push(`${state}: ${upstreamMessage(upstream.data, 'request failed')}`);
        break;
      }
      // The parcels sit in a Laravel-style page: { data: [...], current_page, last_page }.
      const pageData = body?.data && !Array.isArray(body.data) ? body.data : body;
      const parcels = Array.isArray(pageData?.data) ? pageData.data : [];
      for (const p of parcels) {
        const link = typeof p?.tracking_link === 'string' && /^https?:\/\//.test(p.tracking_link) ? p.tracking_link : null;
        if (link && p?.consignment_id != null) links.set(String(p.consignment_id), link);
      }
      const last = Number(pageData?.last_page ?? 1);
      if (parcels.length === 0 || page >= last) break;
      await pause(150);
    }
  }

  let updated = 0;
  for (const table of ['orders', 'wholesale_orders']) {
    const ids = Array.from(links.keys());
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await supabase
        .from(table)
        .select('id, steadfast_consignment_id')
        .in('steadfast_consignment_id', chunk)
        .is('tracking_link', null);
      if (error) {
        failures.push(`${table}: ${error.message}`);
        break;
      }
      for (const row of data ?? []) {
        const { error: updateError } = await supabase
          .from(table)
          .update({ tracking_link: links.get(String(row.steadfast_consignment_id)) })
          .eq('id', row.id);
        if (updateError) failures.push(`${table} ${row.id}: ${updateError.message}`);
        else updated++;
      }
    }
  }
  return { found: links.size, updated, failures };
}

// A parcel Steadfast cancelled (or partly delivered) is on its way back. Only
// /status_with_return_status_by_cid says when it is physically back (`*_return_received`), so ask
// for each parcel not yet known to be back, record it, and put a fully returned parcel's stock
// back once (restock_returned_order guards with orders.stock_restored_at). Restocking is limited
// to parcels cancelled after admin_settings.steadfast_restock_returns_since: older returns may
// have been restocked by hand already. Capped per call to stay inside the worker timeout.
const RETURN_BATCH = 40;

async function syncReturns(supabase: Db, credentials: Credentials) {
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('key, value')
    .in('key', ['steadfast_restock_returns', 'steadfast_restock_returns_since']);
  const setting = (key: string) => settings?.find((s: { key: string }) => s.key === key)?.value ?? null;
  const restockOn = String(setting('steadfast_restock_returns') ?? 'false') === 'true';
  const since = Date.parse(String(setting('steadfast_restock_returns_since') ?? ''));

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, steadfast_consignment_id, courier_status, courier_status_updated_at, courier_return_status, stock_restored_at')
    .not('steadfast_consignment_id', 'is', null)
    .or('courier_status.like.cancelled*,courier_status.like.partial_delivered*')
    .order('courier_status_updated_at', { ascending: false })
    .limit(1000);
  if (error) return { error: error.message };

  // Still on the way back: not yet reported received.
  const open = (orders ?? []).filter(
    (o: { courier_return_status: string | null }) => !o.courier_return_status?.endsWith('_return_received'),
  );
  const batch = open.slice(0, RETURN_BATCH);
  const results: Array<{ order_number: string; return_status: string | null; restocked?: boolean; error?: string }> = [];
  for (const [i, o] of batch.entries()) {
    if (i > 0) await pause(200);
    const upstream = await requestSteadfast(
      `/status_with_return_status_by_cid/${encodeURIComponent(o.steadfast_consignment_id)}`,
      credentials,
    );
    // deno-lint-ignore no-explicit-any
    const body = upstream.data as any;
    const status = typeof body?.delivery_status === 'string' ? body.delivery_status.trim().toLowerCase() : null;
    if (!upstream.ok || !status) {
      results.push({ order_number: o.order_number, return_status: null, error: upstreamMessage(upstream.data, 'lookup failed') });
      continue;
    }

    const isReturnStatus = status.includes('_return_');
    if (isReturnStatus && status !== o.courier_return_status) {
      const { error: updateError } = await supabase.from('orders').update({ courier_return_status: status }).eq('id', o.id);
      if (updateError) {
        results.push({ order_number: o.order_number, return_status: status, error: updateError.message });
        continue;
      }
    }

    let restocked = false;
    const cancelledAt = o.courier_status_updated_at ? Date.parse(o.courier_status_updated_at) : NaN;
    if (
      restockOn &&
      status === 'cancelled_return_received' &&
      !o.stock_restored_at &&
      Number.isFinite(since) &&
      Number.isFinite(cancelledAt) &&
      cancelledAt >= since
    ) {
      const { data: done, error: rpcError } = await supabase.rpc('restock_returned_order', { p_order_id: o.id });
      if (rpcError) {
        results.push({ order_number: o.order_number, return_status: status, error: rpcError.message });
        continue;
      }
      restocked = done === true;
    }
    results.push({ order_number: o.order_number, return_status: isReturnStatus ? status : null, restocked });
  }

  return {
    checked: batch.length,
    received: results.filter((r) => r.return_status?.endsWith('_return_received')).length,
    restocked: results.filter((r) => r.restocked).length,
    more: open.length > RETURN_BATCH,
    restock_enabled: restockOn,
    results,
  };
}

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function requiredPathId(value: unknown, label: string): { value: string } | { error: string } {
  const id = String(value ?? '').trim();
  if (!id) return { error: `${label} is required` };
  return { value: id };
}

function returnRequestPayload(body: ManagementRequest): { value: Record<string, string> } | { error: string } {
  const identifiers = [
    ['consignment_id', body.consignment_id],
    ['invoice', body.invoice],
    ['tracking_code', body.tracking_code],
  ].filter(([, value]) => String(value ?? '').trim());

  if (identifiers.length !== 1) {
    return { error: 'Provide exactly one of consignment ID, invoice, or tracking code' };
  }

  const [key, rawValue] = identifiers[0];
  const payload: Record<string, string> = { [String(key)]: String(rawValue).trim() };
  if (body.reason?.trim()) payload.reason = body.reason.trim();
  return { value: payload };
}

function requestFor(body: ManagementRequest):
  | { path: string; init?: RequestInit }
  | { error: string } {
  switch (body.action) {
    case 'get_balance':
      return { path: '/get_balance' };
    case 'create_return_request': {
      const payload = returnRequestPayload(body);
      if ('error' in payload) return payload;
      return { path: '/create_return_request', init: { method: 'POST', body: JSON.stringify(payload.value) } };
    }
    case 'get_return_request': {
      const id = requiredPathId(body.return_request_id, 'Return request ID');
      if ('error' in id) return id;
      return { path: `/get_return_request/${encodeURIComponent(id.value)}` };
    }
    case 'get_return_requests':
      return { path: '/get_return_requests' };
    case 'get_payments':
      return { path: '/payments' };
    case 'get_payment': {
      const id = requiredPathId(body.payment_id, 'Payment ID');
      if ('error' in id) return id;
      return { path: `/payments/${encodeURIComponent(id.value)}` };
    }
    case 'get_police_stations':
      return { path: '/police_stations' };
    default:
      return { error: 'Unsupported Steadfast management action' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const body = await req.json() as ManagementRequest;
    if (!actions.has(body.action)) {
      return json({ error: 'Unsupported Steadfast management action' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const credentials = await getSteadfastCredentials(supabase);
    if (!hasSteadfastCredentials(credentials)) {
      return json({ error: 'Steadfast credentials not configured. Please add them in Admin → Steadfast settings.' }, 500);
    }

    if (body.action === 'backfill_tracking_links') {
      return json({ success: true, action: body.action, data: await backfillTrackingLinks(supabase, credentials) }, 200);
    }
    if (body.action === 'sync_returns') {
      const data = await syncReturns(supabase, credentials);
      if ('error' in data) return json({ success: false, action: body.action, error: data.error }, 500);
      return json({ success: true, action: body.action, data }, 200);
    }

    const request = requestFor(body);
    if ('error' in request) return json(request, 400);

    const upstream = await requestSteadfast(request.path, credentials, request.init);
    const validApiStatus = !upstream.data || typeof upstream.data !== 'object'
      || !('status' in upstream.data)
      || (upstream.data as { status?: unknown }).status === 200;
    const success = upstream.ok && validApiStatus;

    if (!success) {
      return json({
        success: false,
        action: body.action,
        error: upstreamMessage(upstream.data, `Steadfast ${body.action} request failed`),
        details: upstream.data,
      }, upstream.ok ? 400 : 502);
    }

    return json({
      success: true,
      action: body.action,
      data: upstream.data,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('steadfast-management failed:', message);
    return json({ error: message }, 500);
  }
});
