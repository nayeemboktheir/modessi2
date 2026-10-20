// BotBhai (chat.botbhai.net) REST client and the sync logic built on it.
//
// Modessi is the source of truth for the catalogue and for stock: products,
// variations and absolute stock figures are pushed to BotBhai so its chatbot sells
// what we actually have. Orders move both ways — website orders are mirrored to
// BotBhai, and orders the chatbot takes are imported here as order_source 'botbhai'.
// public.botbhai_order_links records every order that has crossed over so nothing is
// imported twice and nothing we pushed comes back as an import.
//
// The API key is a container env var (BOTBHAI_API_KEY) and never reaches the browser.
// It needs the scopes products:read, products:write, orders:read and orders:write.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const BASE_URL = 'https://chat.botbhai.net/api/v1/external';
const MAX_RETRIES = 3;
// A Retry-After longer than this would push the worker past its timeout; give up
// and let the caller report it instead.
const MAX_RETRY_WAIT_SECONDS = 30;

export class BotbhaiError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function botbhaiConfigured(): boolean {
  return !!Deno.env.get('BOTBHAI_API_KEY');
}

const sleep = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

function retryAfterSeconds(header: string | null, attempt: number): number {
  const fallback = 2 ** attempt * 2;
  if (!header) return fallback;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, seconds);

  // Retry-After may also be an HTTP date.
  const at = Date.parse(header);
  if (Number.isFinite(at)) return Math.max(1, Math.ceil((at - Date.now()) / 1000));

  return fallback;
}

/**
 * Call the BotBhai API. Waits out 429s using Retry-After, and retries network
 * failures only when the request is safe to repeat (a GET, or a POST carrying an
 * Idempotency-Key). Non-2xx answers other than 207 throw a BotbhaiError carrying
 * BotBhai's error `code`.
 */
export async function botbhai(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<{ status: number; data: any }> {
  const apiKey = Deno.env.get('BOTBHAI_API_KEY');
  if (!apiKey) throw new BotbhaiError(0, 'not_configured', 'BOTBHAI_API_KEY is not set');

  const headers: Record<string, string> = { 'x-api-key': apiKey, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const repeatable = method === 'GET' || !!idempotencyKey;

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      if (repeatable && attempt < MAX_RETRIES) {
        await sleep(2 ** attempt);
        continue;
      }
      throw new BotbhaiError(0, 'network_error', `BotBhai unreachable: ${(err as Error).message}`);
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const wait = retryAfterSeconds(res.headers.get('retry-after'), attempt);
      await res.body?.cancel();
      if (wait > MAX_RETRY_WAIT_SECONDS) {
        throw new BotbhaiError(429, 'rate_limit_exceeded', `BotBhai rate limit: retry in ${wait}s`);
      }
      await sleep(wait);
      continue;
    }

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      // validation_failed says *that* a field is wrong; the details say which.
      const details = data?.details ?? data?.errors ?? data?.fields;
      const message = data?.error ?? `BotBhai ${method} ${path} answered HTTP ${res.status}`;
      throw new BotbhaiError(
        res.status,
        data?.code ?? null,
        details ? `${message}: ${typeof details === 'string' ? details : JSON.stringify(details)}` : message,
      );
    }

    return { status: res.status, data };
  }
}

// Single-record endpoints may or may not wrap the record in { data }.
const unwrap = (x: any) => (x && typeof x === 'object' && !Array.isArray(x) && x.data !== undefined ? x.data : x);
const listOf = (x: any): any[] => {
  const v = unwrap(x);
  return Array.isArray(v) ? v : [];
};
const enc = encodeURIComponent;
const sameName = (a: unknown, b: unknown) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
const isNotFound = (err: unknown) => err instanceof BotbhaiError && err.status === 404;

export async function botbhaiAutoSyncEnabled(supabase: SupabaseClient): Promise<boolean> {
  if (!botbhaiConfigured()) return false;

  const { data } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'botbhai_auto_sync')
    .maybeSingle();

  return data?.value === 'true';
}

// ---------------------------------------------------------------------------
// Products, variations and stock
// ---------------------------------------------------------------------------

export const PRODUCT_SELECT =
  'id, name, price, description, short_description, images, stock, is_active, created_at, ' +
  'categories(name), product_variations(id, name, price, stock, is_active, sort_order)';

type VariationRow = {
  id: string;
  name: string;
  price: number;
  stock: number;
  is_active: boolean | null;
  sort_order: number | null;
};

export type ProductRow = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  short_description: string | null;
  images: string[] | null;
  stock: number;
  is_active: boolean | null;
  categories: { name: string } | null;
  product_variations: VariationRow[] | null;
};

// Oversells leave negative stock here; BotBhai should just see "none left".
const stockFigure = (n: number) => Math.max(0, Math.trunc(Number(n) || 0));

const activeVariations = (p: ProductRow) =>
  (p.product_variations ?? [])
    .filter((v) => v.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

function cheapestVariationPrice(p: ProductRow): number {
  const prices = activeVariations(p).map((v) => Number(v.price)).filter((n) => n > 0);
  return prices.length > 0 ? Math.min(...prices) : 0;
}

function productPayload(p: ProductRow) {
  // The old WordPress image URLs answer with the SPA's index.html, not an image;
  // don't hand those to the chatbot.
  const images = (p.images ?? []).filter(
    (u) => /^https?:\/\//.test(u) && !u.includes('modessi.shop/wp-content/'),
  );

  return {
    product_id: p.id,
    product_name: p.name,
    // Some products carry their real prices only on their sizes and 0 here;
    // BotBhai rejects a zero price, so fall back to the cheapest size.
    selling_price: Number(p.price) > 0 ? Number(p.price) : cheapestVariationPrice(p),
    description: p.short_description || p.description || undefined,
    category: p.categories?.name ?? undefined,
    images,
    track_inventory: true,
    stock: stockFigure(p.stock),
  };
}

function variationPayload(v: VariationRow) {
  return {
    name: v.name,
    selling_price: Number(v.price),
    stock: stockFigure(v.stock),
    sort_order: v.sort_order ?? 0,
  };
}

/** Upsert each active variation and deactivate BotBhai variations we no longer have. */
async function syncVariations(p: ProductRow): Promise<void> {
  const active = activeVariations(p);

  for (const v of active) {
    await botbhai('POST', `/products/${enc(p.id)}/variations`, variationPayload(v));
  }

  const remote = listOf((await botbhai('GET', `/products/${enc(p.id)}/variations`)).data);
  for (const r of remote) {
    if (r?.id && r.is_active !== false && !active.some((v) => sameName(v.name, r.name))) {
      await botbhai('DELETE', `/products/${enc(p.id)}/variations/${enc(r.id)}`);
    }
  }
}

export type SyncError = { productId: string; name: string; error: string };

/**
 * Full push of the given products: active ones are upserted (bulk, 100 at a time)
 * along with their variations, inactive ones are archived on BotBhai.
 */
export async function pushProducts(products: ProductRow[]): Promise<{ synced: number; archived: number; errors: SyncError[] }> {
  const errors: SyncError[] = [];
  const fail = (p: ProductRow, err: unknown) =>
    errors.push({ productId: p.id, name: p.name, error: (err as Error)?.message ?? String(err) });

  const active = products.filter((p) => p.is_active !== false);
  const inactive = products.filter((p) => p.is_active === false);
  const failedIds = new Set<string>();

  for (let i = 0; i < active.length; i += 100) {
    const chunk = active.slice(i, i + 100);
    try {
      const { status, data } = await botbhai('POST', '/products/bulk', { products: chunk.map(productPayload) });

      // 207: some items failed. Pick them out of the per-item results.
      if (status === 207) {
        const results = listOf(data?.results ?? data);
        results.forEach((r: any, idx: number) => {
          if (r?.error || r?.success === false || r?.ok === false) {
            const p = chunk.find((c) => c.id === (r?.product_id ?? r?.sku)) ?? chunk[idx];
            if (p) {
              failedIds.add(p.id);
              fail(p, new Error(r?.error ?? r?.code ?? 'rejected by BotBhai'));
            }
          }
        });
      }
    } catch (err) {
      // A validation error on a bulk call rejects the whole batch for one bad
      // product; retry one by one so only that product is reported.
      const rejectedAsBatch = err instanceof BotbhaiError && (err.status === 400 || err.status === 422);
      for (const p of chunk) {
        if (!rejectedAsBatch || chunk.length === 1) {
          failedIds.add(p.id);
          fail(p, err);
          continue;
        }
        try {
          await botbhai('POST', '/products', productPayload(p));
        } catch (single) {
          failedIds.add(p.id);
          fail(p, single);
        }
      }
    }
  }

  for (const p of active) {
    if (failedIds.has(p.id) || (p.product_variations ?? []).length === 0) continue;
    try {
      await syncVariations(p);
    } catch (err) {
      failedIds.add(p.id);
      fail(p, err);
    }
  }

  let archived = 0;
  for (const p of inactive) {
    try {
      await botbhai('DELETE', `/products/${enc(p.id)}`);
      archived++;
    } catch (err) {
      // Never synced in the first place — nothing to archive.
      if (!isNotFound(err)) fail(p, err);
    }
  }

  return { synced: active.length - failedIds.size, archived, errors };
}

/**
 * Push current stock for products touched by an order. Only the variations named in
 * `variationIds` are sent for variation-based products; a product BotBhai doesn't
 * know yet gets a full upsert instead.
 */
export async function pushStock(
  supabase: SupabaseClient,
  productIds: string[],
  variationIds: string[] = [],
): Promise<{ errors: SyncError[] }> {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (ids.length === 0) return { errors: [] };

  const { data: products, error } = await supabase.from('products').select(PRODUCT_SELECT).in('id', ids);
  if (error) throw error;

  const errors: SyncError[] = [];

  for (const p of (products ?? []) as unknown as ProductRow[]) {
    if (p.is_active === false) continue;

    try {
      const variations = activeVariations(p);
      if (variations.length === 0) {
        await botbhai('PATCH', `/products/${enc(p.id)}/stock`, { stock: stockFigure(p.stock) });
        continue;
      }

      const touched = variations.filter((v) => variationIds.includes(v.id));
      for (const v of touched.length > 0 ? touched : variations) {
        await botbhai('POST', `/products/${enc(p.id)}/variations`, variationPayload(v));
      }
    } catch (err) {
      if (!isNotFound(err)) {
        errors.push({ productId: p.id, name: p.name, error: (err as Error).message });
        continue;
      }
      const full = await pushProducts([p]);
      errors.push(...full.errors);
    }
  }

  return { errors };
}

// ---------------------------------------------------------------------------
// Orders: Modessi -> BotBhai
// ---------------------------------------------------------------------------

async function remoteVariations(productId: string, cache: Map<string, any[]>): Promise<any[]> {
  if (!cache.has(productId)) {
    cache.set(productId, listOf((await botbhai('GET', `/products/${enc(productId)}/variations`)).data));
  }
  return cache.get(productId)!;
}

export type PushOrderResult =
  | { status: 'pushed'; botbhaiOrderNumber: string }
  | { status: 'skipped'; reason: string };

/**
 * Mirror one Modessi order to BotBhai. Safe to call repeatedly: an order already
 * linked is skipped, and the Idempotency-Key makes a retried POST replay the
 * original BotBhai order rather than create a second one.
 */
export async function pushOrder(
  supabase: SupabaseClient,
  orderId: string,
  shippingZone?: 'inside_dhaka' | 'outside_dhaka',
): Promise<PushOrderResult> {
  const { data: link } = await supabase
    .from('botbhai_order_links')
    .select('botbhai_order_number')
    .eq('order_id', orderId)
    .maybeSingle();
  if (link) return { status: 'skipped', reason: `already linked to BotBhai ${link.botbhai_order_number}` };

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, order_source, payment_method, shipping_name, shipping_phone, shipping_street, ' +
        'shipping_cost, order_items(product_id, variation_id, variation_name, quantity)',
    )
    .eq('id', orderId)
    .single();
  if (error) throw error;

  const o = order as any;
  if (o.order_source === 'botbhai') return { status: 'skipped', reason: 'order came from BotBhai' };

  const cache = new Map<string, any[]>();
  const items: Array<{ sku: string; quantity: number; variation_id?: string }> = [];
  const sizeNotes: string[] = [];

  for (const it of o.order_items ?? []) {
    // Custom (non-catalogue) lines have no SKU on BotBhai's side.
    if (!it.product_id) continue;

    const line: { sku: string; quantity: number; variation_id?: string } = {
      sku: it.product_id,
      quantity: it.quantity,
    };

    if (it.variation_id) {
      let match = (await remoteVariations(it.product_id, cache)).find((r) => sameName(r.name, it.variation_name));
      if (!match) {
        // Product or variation not on BotBhai yet: push it, then look again.
        const { data: p } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', it.product_id).single();
        if (p) await pushProducts([p as unknown as ProductRow]);
        cache.delete(it.product_id);
        match = (await remoteVariations(it.product_id, cache)).find((r) => sameName(r.name, it.variation_name));
      }
      if (!match?.id) throw new Error(`Variation "${it.variation_name}" of ${it.product_id} is not on BotBhai`);
      line.variation_id = match.id;
    } else {
      // BotBhai refuses a line without a size for a product that has sizes. Older
      // website orders (or ones placed before sizes were added) have none recorded,
      // so send the first size and say so on the BotBhai order.
      const sizes = (await remoteVariations(it.product_id, cache)).filter((r) => r?.id && r.is_active !== false);
      if (sizes.length > 0) {
        const chosen = sizes.find((r) => sameName(r.name, it.variation_name)) ?? sizes[0];
        line.variation_id = chosen.id;
        sizeNotes.push(`${it.product_id}: no size on the website order, sent as "${chosen.name}"`);
      }
    }

    items.push(line);
  }

  if (items.length === 0) return { status: 'skipped', reason: 'no catalogue items' };

  const deliveryArea = shippingZone ?? (Number(o.shipping_cost) <= 80 ? 'inside_dhaka' : 'outside_dhaka');

  const { data } = await botbhai(
    'POST',
    '/orders',
    {
      items,
      customer_name: o.shipping_name,
      customer_phone: o.shipping_phone,
      customer_address: o.shipping_street,
      delivery_area: deliveryArea,
      payment_method: o.payment_method || 'cod',
    },
    `modessi-order-${o.id}`,
  );

  const botbhaiOrderNumber = unwrap(data)?.order_number;
  if (!botbhaiOrderNumber) throw new Error('BotBhai created the order but returned no order_number');

  const { error: linkError } = await supabase.from('botbhai_order_links').insert({
    botbhai_order_number: String(botbhaiOrderNumber),
    order_id: o.id,
    direction: 'pushed',
  });
  if (linkError && linkError.code !== '23505') throw linkError;

  try {
    await botbhai('POST', `/orders/${enc(botbhaiOrderNumber)}/notes`, {
      note: [`Website order #${o.order_number} on modessi.shop`, ...sizeNotes].join('\n'),
    });
  } catch (err) {
    console.warn('BotBhai note failed (order was pushed):', (err as Error).message);
  }

  return { status: 'pushed', botbhaiOrderNumber: String(botbhaiOrderNumber) };
}

/**
 * Called from place-order in the background. Never throws: a BotBhai outage must
 * not affect checkout, and push_recent_orders can catch up afterwards.
 */
export async function mirrorNewOrder(
  supabase: SupabaseClient,
  orderId: string,
  shippingZone: 'inside_dhaka' | 'outside_dhaka',
  items: Array<{ productId: string | null; variationId: string | null }>,
): Promise<void> {
  try {
    if (!(await botbhaiAutoSyncEnabled(supabase))) return;

    const result = await pushOrder(supabase, orderId, shippingZone);
    console.log('BotBhai order push:', JSON.stringify(result));

    const stock = await pushStock(
      supabase,
      items.map((i) => i.productId).filter((x): x is string => !!x),
      items.map((i) => i.variationId).filter((x): x is string => !!x),
    );
    if (stock.errors.length > 0) console.warn('BotBhai stock push errors:', JSON.stringify(stock.errors));
  } catch (err) {
    console.error('BotBhai mirror failed:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Orders: BotBhai -> Modessi
// ---------------------------------------------------------------------------

function normalizeBdPhoneLocal(phone: string) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('880')) digits = digits.slice(3);
  if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`;
  return digits;
}

const num = (...values: unknown[]) => {
  for (const v of values) {
    const n = Number(v);
    if (v !== null && v !== undefined && v !== '' && Number.isFinite(n)) return n;
  }
  return null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ImportedOrder = {
  botbhaiOrderNumber: string;
  orderId: string;
  orderNumber: string;
  productIds: string[];
  variationIds: string[];
};

/** Create one Modessi order from a BotBhai order. Returns null if it was already imported. */
export async function importOne(supabase: SupabaseClient, botbhaiOrderNumber: string): Promise<ImportedOrder | null> {
  const detail = unwrap((await botbhai('GET', `/orders/${enc(botbhaiOrderNumber)}`)).data) ?? {};
  const customer = detail.customer ?? {};

  const rawItems = listOf(detail.items ?? detail.order_items);
  const skus = Array.from(
    new Set(rawItems.map((it: any) => String(it.sku ?? it.product_id ?? it.product?.product_id ?? '')).filter((s) => UUID_RE.test(s))),
  );

  const productById = new Map<string, ProductRow>();
  if (skus.length > 0) {
    const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).in('id', skus);
    if (error) throw error;
    for (const p of (data ?? []) as unknown as ProductRow[]) productById.set(p.id, p);
  }

  const cache = new Map<string, any[]>();
  const lines: Array<{
    product_id: string | null;
    variation_id: string | null;
    variation_name: string | null;
    product_name: string;
    product_image: string | null;
    price: number;
    quantity: number;
  }> = [];

  for (const it of rawItems) {
    const quantity = Math.trunc(num(it.quantity, it.qty) ?? 0);
    if (quantity <= 0) continue;

    const sku = String(it.sku ?? it.product_id ?? it.product?.product_id ?? '');
    const unitPrice = num(it.unit_price, it.price, it.selling_price);
    const p = productById.get(sku);

    if (!p) {
      // Something BotBhai sells that isn't in our catalogue: keep it as a custom line.
      lines.push({
        product_id: null,
        variation_id: null,
        variation_name: null,
        product_name: String(it.product_name ?? it.name ?? sku ?? 'BotBhai item').slice(0, 150),
        product_image: null,
        price: unitPrice ?? 0,
        quantity,
      });
      continue;
    }

    let variationName: string | null = it.variation_name ?? it.variation?.name ?? null;
    if (!variationName && it.variation_id) {
      const remote = (await remoteVariations(p.id, cache)).find((r) => r.id === it.variation_id);
      variationName = remote?.name ?? null;
    }
    const v = variationName ? (p.product_variations ?? []).find((x) => sameName(x.name, variationName)) : undefined;

    lines.push({
      product_id: p.id,
      variation_id: v?.id ?? null,
      variation_name: v?.name ?? variationName,
      product_name: v ? `${p.name} (${v.name})` : p.name,
      product_image: p.images?.[0] ?? null,
      price: unitPrice ?? Number(v?.price ?? p.price),
      quantity,
    });
  }

  if (lines.length === 0) throw new Error(`BotBhai order ${botbhaiOrderNumber} has no items`);

  const deliveryArea = detail.delivery_area ?? customer.delivery_area;
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const shippingCost =
    num(detail.delivery_charge, detail.shipping_charge, detail.shipping_cost, detail.delivery_fee) ??
    (deliveryArea === 'inside_dhaka' ? 80 : 130);
  const discount = num(detail.discount, detail.discount_amount) ?? 0;
  const total = subtotal - discount + shippingCost;

  const name = String(detail.customer_name ?? customer.name ?? 'BotBhai customer').trim().slice(0, 100);
  const phone = normalizeBdPhoneLocal(detail.customer_phone ?? customer.phone ?? '');
  const address = String(detail.customer_address ?? detail.delivery_address ?? customer.address ?? '').trim().slice(0, 300);
  const remoteNote = typeof detail.note === 'string' ? detail.note : typeof detail.notes === 'string' ? detail.notes : '';

  const orderId = crypto.randomUUID();

  const { error: orderError } = await supabase.from('orders').insert({
    id: orderId,
    user_id: null,
    order_number: '',
    status: 'pending',
    payment_method: detail.payment_method || 'cod',
    payment_status: 'pending',
    subtotal,
    shipping_cost: shippingCost,
    discount,
    total,
    shipping_name: name,
    shipping_phone: phone,
    shipping_street: address || 'N/A',
    shipping_city: 'N/A',
    shipping_district: 'N/A',
    shipping_postal_code: null,
    notes: `BotBhai order ${botbhaiOrderNumber}${remoteNote ? ` | ${remoteNote}` : ''}`.slice(0, 500),
    order_source: 'botbhai',
  });
  if (orderError) throw orderError;

  // Claim the BotBhai order number before touching items or stock, so a concurrent
  // import of the same order loses here and backs out cleanly.
  const { error: linkError } = await supabase.from('botbhai_order_links').insert({
    botbhai_order_number: botbhaiOrderNumber,
    order_id: orderId,
    direction: 'imported',
  });
  if (linkError) {
    await supabase.from('orders').delete().eq('id', orderId);
    if (linkError.code === '23505') return null;
    throw linkError;
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(lines.map((l) => ({ ...l, order_id: orderId })));
  if (itemsError) {
    await supabase.from('orders').delete().eq('id', orderId);
    throw itemsError;
  }

  // Same bookkeeping as place-order; never refuses, since the sale already happened.
  const { error: stockError } = await supabase.rpc('apply_order_stock', {
    p_items: lines.map((l) => ({ productId: l.product_id, variationId: l.variation_id, quantity: l.quantity })),
    p_enforce: false,
  });
  if (stockError) console.error('BotBhai import: stock update failed:', stockError.message);

  const { data: created } = await supabase.from('orders').select('order_number').eq('id', orderId).single();
  const orderNumber = created?.order_number ?? orderId;

  try {
    await botbhai('POST', `/orders/${enc(botbhaiOrderNumber)}/notes`, {
      note: `Imported into Modessi as order #${orderNumber}`,
    });
  } catch (err) {
    console.warn('BotBhai note failed (order was imported):', (err as Error).message);
  }

  return {
    botbhaiOrderNumber,
    orderId,
    orderNumber,
    productIds: lines.map((l) => l.product_id).filter((x): x is string => !!x),
    variationIds: lines.map((l) => l.variation_id).filter((x): x is string => !!x),
  };
}

/**
 * Import pending/confirmed BotBhai orders from the last `days` days that we have not
 * seen. Orders younger than two minutes are left for the next run, so a website order
 * whose push is still in flight is never mistaken for a chatbot order.
 */
export async function importOrders(
  supabase: SupabaseClient,
  { days = 3, max = 25 }: { days?: number; max?: number } = {},
): Promise<{ imported: ImportedOrder[]; errors: Array<{ botbhaiOrderNumber: string; error: string }>; remaining: number }> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const settled = Date.now() - 2 * 60 * 1000;

  const candidates = new Set<string>();
  for (const status of ['pending', 'confirmed']) {
    for (let page = 1; page <= 10; page++) {
      const { data } = await botbhai('GET', `/orders?status=${status}&page=${page}&limit=100`);
      const rows = listOf(data);

      for (const row of rows) {
        const created = Date.parse(row?.created_at ?? '');
        if (Number.isFinite(created) && (created < cutoff || created > settled)) continue;
        if (row?.order_number) candidates.add(String(row.order_number));
      }

      const total = Number(data?.meta?.total ?? 0);
      if (rows.length < 100 || page * 100 >= total) break;
    }
  }

  const numbers = Array.from(candidates);
  const known = new Set<string>();
  for (let i = 0; i < numbers.length; i += 200) {
    const { data, error } = await supabase
      .from('botbhai_order_links')
      .select('botbhai_order_number')
      .in('botbhai_order_number', numbers.slice(i, i + 200));
    if (error) throw error;
    (data ?? []).forEach((r: { botbhai_order_number: string }) => known.add(r.botbhai_order_number));
  }

  const fresh = numbers.filter((n) => !known.has(n));
  const imported: ImportedOrder[] = [];
  const errors: Array<{ botbhaiOrderNumber: string; error: string }> = [];

  for (const n of fresh.slice(0, max)) {
    try {
      const result = await importOne(supabase, n);
      if (result) imported.push(result);
    } catch (err) {
      errors.push({ botbhaiOrderNumber: n, error: (err as Error)?.message ?? String(err) });
    }
  }

  if (imported.length > 0 && (await botbhaiAutoSyncEnabled(supabase))) {
    const stock = await pushStock(
      supabase,
      imported.flatMap((o) => o.productIds),
      imported.flatMap((o) => o.variationIds),
    );
    if (stock.errors.length > 0) console.warn('BotBhai stock push errors:', JSON.stringify(stock.errors));
  }

  return { imported, errors, remaining: Math.max(0, fresh.length - max) };
}

// ---------------------------------------------------------------------------
// Order status, both ways
// ---------------------------------------------------------------------------

// Statuses both sides share. Modessi lets an admin jump between any of them;
// BotBhai only allows these steps, so a jump is walked one step at a time.
const BOTBHAI_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
};

export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];

function statusPath(from: string, to: string): string[] | null {
  const queue: string[][] = [[from]];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    if (last === to) return path.slice(1);
    for (const next of BOTBHAI_TRANSITIONS[last] ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return null;
}

export async function remoteOrderStatus(botbhaiOrderNumber: string): Promise<string | null> {
  const detail = unwrap((await botbhai('GET', `/orders/${enc(botbhaiOrderNumber)}`)).data);
  return detail?.status ? String(detail.status) : null;
}

export type PushStatusResult =
  | { status: 'pushed'; botbhaiOrderNumber: string; steps: string[] }
  | { status: 'skipped'; reason: string };

/**
 * Bring a linked BotBhai order to the status the Modessi order now has. BotBhai
 * answers each step with an order.status_changed webhook; botbhai-webhook sees the
 * status already matches (or is a step behind BotBhai's current one) and ignores it.
 */
export async function pushOrderStatus(supabase: SupabaseClient, orderId: string): Promise<PushStatusResult> {
  const { data: link } = await supabase
    .from('botbhai_order_links')
    .select('botbhai_order_number')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!link) return { status: 'skipped', reason: 'order is not linked to BotBhai' };

  const { data: order, error } = await supabase.from('orders').select('status').eq('id', orderId).single();
  if (error) throw error;

  const target = String(order.status);
  if (!ORDER_STATUSES.includes(target)) return { status: 'skipped', reason: `BotBhai has no "${target}" status` };

  const current = await remoteOrderStatus(link.botbhai_order_number);
  if (!current) throw new Error(`BotBhai order ${link.botbhai_order_number} has no status`);
  if (current === target) return { status: 'skipped', reason: `already ${target} on BotBhai` };

  const steps = statusPath(current, target);
  if (!steps) return { status: 'skipped', reason: `BotBhai cannot move an order from ${current} to ${target}` };

  for (const step of steps) {
    await botbhai('PATCH', `/orders/${enc(link.botbhai_order_number)}/status`, { status: step });
  }

  return { status: 'pushed', botbhaiOrderNumber: link.botbhai_order_number, steps };
}

export type ApplyStatusResult =
  | { status: 'updated'; orderId: string; from: string; to: string }
  | { status: 'skipped'; reason: string };

/** Set the linked Modessi order to a status BotBhai reported, unless it already has it. */
export async function applyRemoteStatus(
  supabase: SupabaseClient,
  botbhaiOrderNumber: string,
  status: string,
): Promise<ApplyStatusResult> {
  if (!ORDER_STATUSES.includes(status)) return { status: 'skipped', reason: `unknown status "${status}"` };

  const { data: link } = await supabase
    .from('botbhai_order_links')
    .select('order_id')
    .eq('botbhai_order_number', botbhaiOrderNumber)
    .maybeSingle();
  if (!link) return { status: 'skipped', reason: 'order is not linked' };

  const { data: order, error } = await supabase.from('orders').select('status').eq('id', link.order_id).single();
  if (error) throw error;
  if (order.status === status) return { status: 'skipped', reason: `already ${status}` };

  const { error: updateError } = await supabase.from('orders').update({ status }).eq('id', link.order_id);
  if (updateError) throw updateError;

  return { status: 'updated', orderId: link.order_id, from: order.status, to: status };
}
