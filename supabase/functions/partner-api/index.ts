// partner-api: the private API a reseller site (Maxora Outlet) uses to sell Modessi products.
//
//   POST { action: 'catalog' }
//        Active products with their variations, stock and wholesale prices.
//   POST { action: 'create_order', order: {...} }
//        Creates a Modessi order (order_source = partner name) that Modessi packs, ships and
//        collects COD for. Idempotent on order.partner_order_id: sending the same order again
//        returns the order made the first time.
//   POST { action: 'update_order', order: {...} }
//        The partner edited the order: replaces items, amounts and customer, and moves stock,
//        while it has not been handed to the courier (409 after that).
//   POST { action: 'cancel_order', partner_order_id }
//        Cancels the order and puts its stock back, while it is not with the courier.
//   POST { action: 'order_status', partner_order_ids: [...] }
//        Status, tracking, courier outcome, cash collected and Steadfast's delivery charge.
//   POST { action: 'payments' | 'record_payment' | 'delete_payment' }
//        Money Modessi has paid the partner (partner_payments), for the running balance.
//
// Auth, two layers:
//   - The router wants a JWT signed by this stack: the partner sends Modessi's anon key as
//     `Authorization: Bearer` (and `apikey`, for Kong). That alone proves nothing, it is public.
//   - The real gate is `x-partner-key`, checked against admin_settings.partner_keys (or, if
//     that row is empty, the PARTNER_KEYS env var on the edge-functions container):
//     comma-separated `name:secret` pairs, e.g. `maxora:7f3c…`, secrets at least 16 chars.
//     The name becomes the order's order_source and the partner in partner_order_links.
//
// Everything runs with the service role, so a partner only ever sees its own orders.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { getSteadfastCredentials, hasSteadfastCredentials, requestSteadfast } from '../_shared/steadfast.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-partner-key',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The `name:secret,name:secret` list: admin_settings.partner_keys first (admin-only under RLS,
 * like the courier keys), else the PARTNER_KEYS env var. Same order as the courier functions,
 * so a key can be added or rotated from the database without recreating the container.
 */
async function loadPartnerKeys(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.from('admin_settings').select('value').eq('key', 'partner_keys').maybeSingle();
  return String(data?.value || Deno.env.get('PARTNER_KEYS') || '').trim();
}

/** The partner name for this request's x-partner-key, or null. */
function resolvePartner(req: Request, partnerKeys: string): string | null {
  const presented = (req.headers.get('x-partner-key') ?? '').trim();
  if (presented.length < 16) return null;

  let match: string | null = null;
  for (const pair of partnerKeys.split(',')) {
    const idx = pair.indexOf(':');
    if (idx <= 0) continue;
    const name = pair.slice(0, idx).trim().toLowerCase();
    const secret = pair.slice(idx + 1).trim();
    // Compare against every key so timing does not reveal which one matched.
    if (secret.length >= 16 && constantTimeEqual(presented, secret) && /^[a-z0-9_-]{2,30}$/.test(name)) match = name;
  }
  return match;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const money = (n: number) => Math.round(n * 100) / 100;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function normalizeBdPhone(phone: string) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('880')) digits = digits.slice(3);
  if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`;
  return digits;
}

type WholesaleRow = {
  product_id: string;
  variation_id: string | null;
  wholesale_price: number;
  min_quantity: number;
  is_active: boolean;
};

/** Wholesale unit price: the variation's own row first, then the product's. Null when unpriced. */
function wholesaleFor(rows: WholesaleRow[], productId: string, variationId: string | null): number | null {
  const active = rows.filter((r) => r.is_active !== false && r.product_id === productId);
  const own = variationId ? active.find((r) => r.variation_id === variationId) : undefined;
  const base = active.find((r) => r.variation_id === null);
  const row = own ?? base;
  return row ? Number(row.wholesale_price) : null;
}

// ---------------------------------------------------------------------------
// catalog
// ---------------------------------------------------------------------------

async function catalog(supabase: SupabaseClient) {
  const [products, wholesale] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, price, stock, images, is_active, product_variations(id, name, price, stock, is_active, sort_order)')
      .eq('is_active', true)
      .order('name'),
    supabase.from('wholesale_prices').select('product_id, variation_id, wholesale_price, min_quantity, is_active'),
  ]);
  if (products.error) throw products.error;
  if (wholesale.error) throw wholesale.error;

  const rows = (wholesale.data ?? []) as WholesaleRow[];

  return {
    products: (products.data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      stock: Math.max(0, Math.trunc(Number(p.stock) || 0)),
      image: p.images?.[0] ?? null,
      wholesale_price: wholesaleFor(rows, p.id, null),
      variations: (p.product_variations ?? [])
        .filter((v: any) => v.is_active !== false)
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((v: any) => ({
          id: v.id,
          name: v.name,
          price: Number(v.price),
          stock: Math.max(0, Math.trunc(Number(v.stock) || 0)),
          wholesale_price: wholesaleFor(rows, p.id, v.id),
        })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Orders: shared parsing
// ---------------------------------------------------------------------------

type IncomingItem = {
  modessi_product_id: string;
  // Any of the partner's option labels (colour, size, …); matched against our variation names.
  options?: string[];
  description?: string;
  quantity: number;
  price: number; // what the customer pays per unit on the partner site
};

type Line = {
  product_id: string;
  variation_id: string | null;
  variation_name: string | null;
  product_name: string;
  product_image: string | null;
  price: number;
  quantity: number;
};

type ParsedOrder = {
  name: string;
  phone: string;
  address: string;
  lines: Line[];
  wholesaleTotal: number | null;
  subtotal: number;
  shippingCost: number;
  codAmount: number;
  note: string;
};

class BadRequest extends Error {}

async function existingLink(supabase: SupabaseClient, partner: string, partnerOrderId: string) {
  const { data, error } = await supabase
    .from('partner_order_links')
    .select('order_id, cod_amount, wholesale_total, orders(order_number)')
    .eq('partner', partner)
    .eq('partner_order_id', partnerOrderId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

/** Validate a partner order and turn it into our order lines and money. Throws BadRequest. */
async function parseOrder(supabase: SupabaseClient, o: any): Promise<ParsedOrder> {
  const name = str(o.customer?.name, 100);
  const phone = normalizeBdPhone(str(o.customer?.phone, 30));
  const address = str(o.customer?.address, 300);
  if (!name || phone.length !== 11 || !address) {
    throw new BadRequest('customer name, an 11-digit Bangladeshi phone and address are required');
  }

  const items: IncomingItem[] = Array.isArray(o.items) ? o.items : [];
  if (items.length === 0 || items.length > 50) throw new BadRequest('order needs 1–50 items');
  for (const it of items) {
    const q = Number(it?.quantity);
    const p = Number(it?.price);
    if (!UUID_RE.test(String(it?.modessi_product_id ?? '')) || !Number.isInteger(q) || q <= 0 || q > 1000 || !Number.isFinite(p) || p < 0) {
      throw new BadRequest('each item needs modessi_product_id, a whole quantity and a price');
    }
  }

  const productIds = Array.from(new Set(items.map((i) => i.modessi_product_id)));
  const [productsRes, wholesaleRes] = await Promise.all([
    supabase.from('products').select('id, name, images, product_variations(id, name, is_active)').in('id', productIds),
    supabase
      .from('wholesale_prices')
      .select('product_id, variation_id, wholesale_price, min_quantity, is_active')
      .in('product_id', productIds),
  ]);
  if (productsRes.error) throw productsRes.error;
  if (wholesaleRes.error) throw wholesaleRes.error;

  const productById = new Map<string, any>((productsRes.data ?? []).map((p: any) => [p.id, p]));
  const missing = productIds.filter((id) => !productById.has(id));
  if (missing.length > 0) throw new BadRequest(`unknown Modessi product(s): ${missing.join(', ')}`);

  const wholesaleRows = (wholesaleRes.data ?? []) as WholesaleRow[];
  let wholesaleTotal: number | null = 0;

  const lines: Line[] = items.map((it) => {
    const p = productById.get(it.modessi_product_id);
    const options = (it.options ?? []).map(norm).filter(Boolean);
    const variations = (p.product_variations ?? []).filter((v: any) => v.is_active !== false);
    const v =
      variations.find((x: any) => options.includes(norm(x.name))) ??
      variations.find((x: any) => options.length > 1 && norm(x.name) === options.join(' - '));

    const unitCost = wholesaleFor(wholesaleRows, p.id, v?.id ?? null);
    if (unitCost === null || wholesaleTotal === null) wholesaleTotal = null;
    else wholesaleTotal += unitCost * it.quantity;

    const extra = str(it.description, 120);
    const label = `${p.name}${v ? ` (${v.name})` : ''}`;
    return {
      product_id: p.id,
      variation_id: v?.id ?? null,
      variation_name: v?.name ?? (options.length ? (it.options ?? []).join(' / ').slice(0, 100) : null),
      product_name: (extra && norm(extra) !== norm(label) ? `${label} — ${extra}` : label).slice(0, 200),
      product_image: p.images?.[0] ?? null,
      price: money(Number(it.price)),
      quantity: it.quantity,
    };
  });

  const subtotal = money(lines.reduce((s, l) => s + l.price * l.quantity, 0));
  const shippingCost = money(Math.max(0, Number(o.shipping_cost) || 0));
  const discount = money(Math.max(0, Number(o.discount) || 0));
  // The partner states the exact amount to collect (it may have taken an advance).
  const codAmount = money(Math.max(0, Number(o.cod_amount ?? subtotal - discount + shippingCost) || 0));

  return {
    name,
    phone,
    address,
    lines,
    wholesaleTotal: wholesaleTotal === null ? null : money(wholesaleTotal),
    subtotal,
    shippingCost,
    codAmount,
    note: str(o.note, 300),
  };
}

const orderFields = (partner: string, partnerOrderNumber: string, p: ParsedOrder) => ({
  subtotal: p.subtotal,
  shipping_cost: p.shippingCost,
  discount: money(Math.max(0, p.subtotal + p.shippingCost - p.codAmount)),
  total: p.codAmount,
  shipping_name: p.name,
  shipping_phone: p.phone,
  shipping_street: p.address,
  notes: `${partner} order #${partnerOrderNumber}${p.note ? ` | ${p.note}` : ''}`.slice(0, 500),
});

const stockItems = (lines: Array<{ product_id: string | null; variation_id: string | null; quantity: number }>) =>
  lines.map((l) => ({ productId: l.product_id, variationId: l.variation_id, quantity: l.quantity }));

// Not yet with the courier: the partner may still change or cancel it.
const isOpen = (order: { status: string; steadfast_consignment_id: string | null }) =>
  !order.steadfast_consignment_id && !['shipped', 'delivered', 'returned', 'cancelled'].includes(order.status);

// ---------------------------------------------------------------------------
// create_order
// ---------------------------------------------------------------------------

async function createOrder(supabase: SupabaseClient, partner: string, body: any): Promise<Response> {
  const o = body?.order ?? {};
  const partnerOrderId = str(o.partner_order_id, 100);
  if (!partnerOrderId) return json({ error: 'order.partner_order_id is required' }, 400);

  const already = await existingLink(supabase, partner, partnerOrderId);
  if (already) {
    return json({
      created: false,
      order_id: already.order_id,
      order_number: already.orders?.order_number ?? null,
      cod_amount: Number(already.cod_amount),
      wholesale_total: already.wholesale_total === null ? null : Number(already.wholesale_total),
    });
  }

  const parsed = await parseOrder(supabase, o);
  const partnerOrderNumber = str(o.partner_order_number, 50) || partnerOrderId;

  const orderId = crypto.randomUUID();
  const { error: orderError } = await supabase.from('orders').insert({
    id: orderId,
    user_id: null,
    order_number: '',
    status: 'pending',
    payment_method: 'cod',
    payment_status: 'pending',
    shipping_city: 'N/A',
    shipping_district: 'N/A',
    shipping_postal_code: null,
    order_source: partner,
    ...orderFields(partner, partnerOrderNumber, parsed),
  });
  if (orderError) throw orderError;

  // Claim the partner order id before items and stock, so a concurrent retry of the same
  // order loses here and backs out cleanly.
  const { error: linkError } = await supabase.from('partner_order_links').insert({
    partner,
    partner_order_id: partnerOrderId,
    partner_order_number: partnerOrderNumber,
    order_id: orderId,
    cod_amount: parsed.codAmount,
    wholesale_total: parsed.wholesaleTotal,
  });
  if (linkError) {
    await supabase.from('orders').delete().eq('id', orderId);
    if (linkError.code === '23505') return createOrder(supabase, partner, body);
    throw linkError;
  }

  const { error: itemsError } = await supabase.from('order_items').insert(parsed.lines.map((l) => ({ ...l, order_id: orderId })));
  if (itemsError) {
    await supabase.from('orders').delete().eq('id', orderId);
    throw itemsError;
  }

  // Same bookkeeping as place-order; never refuses, since the partner already made the sale.
  const { error: stockError } = await supabase.rpc('apply_order_stock', { p_items: stockItems(parsed.lines), p_enforce: false });
  if (stockError) console.error('partner-api: stock update failed:', stockError.message);

  const { data: created } = await supabase.from('orders').select('order_number').eq('id', orderId).single();

  return json({
    created: true,
    order_id: orderId,
    order_number: created?.order_number ?? null,
    cod_amount: parsed.codAmount,
    wholesale_total: parsed.wholesaleTotal,
  });
}

// ---------------------------------------------------------------------------
// update_order: the partner edited the order (items, amounts, customer)
// ---------------------------------------------------------------------------

async function updateOrder(supabase: SupabaseClient, partner: string, body: any): Promise<Response> {
  const o = body?.order ?? {};
  const partnerOrderId = str(o.partner_order_id, 100);
  if (!partnerOrderId) return json({ error: 'order.partner_order_id is required' }, 400);

  const link = await existingLink(supabase, partner, partnerOrderId);
  if (!link) return json({ error: 'not found' }, 404);

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, steadfast_consignment_id, order_items(product_id, variation_id, quantity)')
    .eq('id', link.order_id)
    .single();
  if (error) throw error;
  if (!isOpen(order)) return json({ updated: false, reason: `already ${order.steadfast_consignment_id ? 'with the courier' : order.status}` }, 409);

  const parsed = await parseOrder(supabase, o);
  const partnerOrderNumber = str(o.partner_order_number, 50) || partnerOrderId;

  // Stock: give back what the old lines took, then take what the new lines need.
  const { error: restoreError } = await supabase.rpc('restore_order_stock', { p_items: stockItems(order.order_items ?? []) });
  if (restoreError) throw restoreError;

  const { error: deleteError } = await supabase.from('order_items').delete().eq('order_id', order.id);
  if (deleteError) throw deleteError;
  const { error: itemsError } = await supabase.from('order_items').insert(parsed.lines.map((l) => ({ ...l, order_id: order.id })));
  if (itemsError) throw itemsError;

  const { error: stockError } = await supabase.rpc('apply_order_stock', { p_items: stockItems(parsed.lines), p_enforce: false });
  if (stockError) console.error('partner-api: stock update failed:', stockError.message);

  const { error: orderError } = await supabase.from('orders').update(orderFields(partner, partnerOrderNumber, parsed)).eq('id', order.id);
  if (orderError) throw orderError;

  const { error: linkError } = await supabase
    .from('partner_order_links')
    .update({ cod_amount: parsed.codAmount, wholesale_total: parsed.wholesaleTotal, updated_at: new Date().toISOString() })
    .eq('partner', partner)
    .eq('partner_order_id', partnerOrderId);
  if (linkError) throw linkError;

  return json({ updated: true, cod_amount: parsed.codAmount, wholesale_total: parsed.wholesaleTotal });
}

// ---------------------------------------------------------------------------
// cancel_order
// ---------------------------------------------------------------------------

async function cancelOrder(supabase: SupabaseClient, partner: string, body: any): Promise<Response> {
  const partnerOrderId = str(body?.partner_order_id, 100);
  if (!partnerOrderId) return json({ error: 'partner_order_id is required' }, 400);

  const link = await existingLink(supabase, partner, partnerOrderId);
  if (!link) return json({ cancelled: false, reason: 'not found' }, 404);

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, steadfast_consignment_id, order_items(product_id, variation_id, quantity)')
    .eq('id', link.order_id)
    .single();
  if (error) throw error;

  if (order.status === 'cancelled') return json({ cancelled: true, already: true });
  if (!isOpen(order)) return json({ cancelled: false, reason: 'already handed to the courier' }, 409);

  // Flip once, guarded, so the stock below is given back exactly once.
  const { data: flipped, error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', order.id)
    .neq('status', 'cancelled')
    .is('steadfast_consignment_id', null)
    .select('id');
  if (updateError) throw updateError;
  if (!flipped || flipped.length === 0) return json({ cancelled: false, reason: 'order changed meanwhile, try again' }, 409);

  const { error: restoreError } = await supabase.rpc('restore_order_stock', { p_items: stockItems(order.order_items ?? []) });
  if (restoreError) console.error('partner-api: stock restore failed:', restoreError.message);

  return json({ cancelled: true });
}

// ---------------------------------------------------------------------------
// order_status
// ---------------------------------------------------------------------------

async function deliveryStatus(credentials: { apiKey: string; secretKey: string }, consignmentId: string): Promise<string | null> {
  try {
    const res = await requestSteadfast(`/status_by_cid/${encodeURIComponent(consignmentId)}`, credentials, {}, 10_000);
    const data = res.data as any;
    return res.ok && typeof data?.delivery_status === 'string' ? data.delivery_status.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function orderStatus(supabase: SupabaseClient, partner: string, body: any): Promise<Response> {
  const ids: string[] = Array.isArray(body?.partner_order_ids)
    ? body.partner_order_ids.map((x: unknown) => String(x)).filter(Boolean).slice(0, 100)
    : [];
  if (ids.length === 0) return json({ orders: [] });

  const { data, error } = await supabase
    .from('partner_order_links')
    .select(
      'partner_order_id, cod_amount, wholesale_total, orders(id, order_number, status, tracking_number, steadfast_consignment_id, steadfast_sent_at, courier_status, courier_cod_amount, courier_delivery_charge, updated_at)',
    )
    .eq('partner', partner)
    .in('partner_order_id', ids);
  if (error) throw error;

  const rows = (data ?? []) as any[];

  // The webhook keeps courier_status current. Ask Steadfast directly only for parcels it has
  // not reported on yet (e.g. the webhook is not set up), a few at a time.
  const credentials = await getSteadfastCredentials(supabase);
  const live = new Map<string, string | null>();
  const toAsk = rows
    .map((r) => r.orders)
    .filter((ord) => ord?.steadfast_consignment_id && !ord.courier_status && !['delivered', 'cancelled', 'returned'].includes(ord.status));
  if (hasSteadfastCredentials(credentials)) {
    for (let i = 0; i < toAsk.length; i += 5) {
      await Promise.all(
        toAsk.slice(i, i + 5).map(async (ord) => live.set(ord.id, await deliveryStatus(credentials, String(ord.steadfast_consignment_id)))),
      );
    }
  }

  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  return json({
    orders: rows.map((r) => {
      const ord = r.orders;
      return {
        partner_order_id: r.partner_order_id,
        order_id: ord?.id ?? null,
        order_number: ord?.order_number ?? null,
        status: ord?.status ?? null,
        tracking_number: ord?.tracking_number ?? null,
        consignment_id: ord?.steadfast_consignment_id ?? null,
        sent_at: ord?.steadfast_sent_at ?? null,
        delivery_status: ord ? ord.courier_status ?? live.get(ord.id) ?? null : null,
        courier_cod_amount: num(ord?.courier_cod_amount),
        courier_delivery_charge: num(ord?.courier_delivery_charge),
        cod_amount: Number(r.cod_amount),
        wholesale_total: num(r.wholesale_total),
        updated_at: ord?.updated_at ?? null,
      };
    }),
  });
}

// ---------------------------------------------------------------------------
// payments: money Modessi pays the partner
// ---------------------------------------------------------------------------

async function listPayments(supabase: SupabaseClient, partner: string): Promise<Response> {
  const { data, error } = await supabase
    .from('partner_payments')
    .select('id, amount, paid_at, note, recorded_by, created_at')
    .eq('partner', partner)
    .order('paid_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return json({ payments: data ?? [] });
}

async function recordPayment(supabase: SupabaseClient, partner: string, body: any): Promise<Response> {
  const p = body?.payment ?? {};
  const id = String(p.id ?? '');
  const amount = money(Number(p.amount));
  const paidAt = String(p.paid_at ?? '');
  if (!UUID_RE.test(id) || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 10_000_000 || !/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
    return json({ error: 'payment needs an id, a non-zero amount and paid_at (yyyy-mm-dd)' }, 400);
  }
  // Idempotent on id: a retry of the same payment changes nothing.
  const { error } = await supabase
    .from('partner_payments')
    .upsert({ id, partner, amount, paid_at: paidAt, note: str(p.note, 300) || null, recorded_by: 'partner' }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
  return json({ recorded: true });
}

async function deletePayment(supabase: SupabaseClient, partner: string, body: any): Promise<Response> {
  const id = String(body?.payment_id ?? '');
  if (!UUID_RE.test(id)) return json({ error: 'payment_id required' }, 400);
  const { error } = await supabase.from('partner_payments').delete().eq('id', id).eq('partner', partner);
  if (error) throw error;
  return json({ deleted: true });
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Cheap reject before touching the database.
  if ((req.headers.get('x-partner-key') ?? '').trim().length < 16) return json({ error: 'Invalid partner key' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server not configured' }, 500);
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const partner = resolvePartner(req, await loadPartnerKeys(supabase));
  if (!partner) return json({ error: 'Invalid partner key' }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  try {
    switch (body?.action) {
      case 'catalog':
        return json(await catalog(supabase));
      case 'create_order':
        return await createOrder(supabase, partner, body);
      case 'update_order':
        return await updateOrder(supabase, partner, body);
      case 'cancel_order':
        return await cancelOrder(supabase, partner, body);
      case 'order_status':
        return await orderStatus(supabase, partner, body);
      case 'payments':
        return await listPayments(supabase, partner);
      case 'record_payment':
        return await recordPayment(supabase, partner, body);
      case 'delete_payment':
        return await deletePayment(supabase, partner, body);
      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    if (err instanceof BadRequest) return json({ error: err.message }, 400);
    console.error(`partner-api (${partner}) ${body?.action} failed:`, (err as Error)?.message ?? err);
    return json({ error: 'Internal error' }, 500);
  }
});
