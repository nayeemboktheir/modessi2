// botbhai-sync: admin-driven sync between Modessi and BotBhai (chat.botbhai.net).
//
// Actions (POST { action, ... }):
//   status              key configured?, auto-sync flag, link counts, a live API check
//   sync_products       full push of one page of products { offset, limit } — the admin
//                       page loops until nextOffset is null, so no single worker runs
//                       into the 150s timeout or the 120 req/min BotBhai budget
//   push_stock          { productIds } current stock for those products
//   push_order          { orderId } mirror one order (retry for a failed auto-push)
//   push_recent_orders  { days } mirror website orders not yet on BotBhai
//   push_status         { orderIds } bring linked BotBhai orders to their Modessi status
//   import_orders       { days } pull new chatbot orders in as order_source 'botbhai'
//
// The BotBhai key lives only in this container's BOTBHAI_API_KEY env var.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { corsHeaders, requireAdminOrInternal } from '../_shared/auth.ts';
import {
  BotbhaiError,
  PRODUCT_SELECT,
  ProductRow,
  botbhai,
  botbhaiConfigured,
  importOrders,
  pushOrder,
  pushOrderStatus,
  pushProducts,
  pushStock,
} from '../_shared/botbhai.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await requireAdminOrInternal(req);
  if (!auth.ok) return auth.response;

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const action = body?.action;

  if (action !== 'status' && !botbhaiConfigured()) {
    return json({ error: 'BOTBHAI_API_KEY is not set on the edge-functions container', code: 'not_configured' }, 400);
  }

  try {
    switch (action) {
      case 'status': {
        const [{ data: setting }, pushed, imported] = await Promise.all([
          supabase.from('admin_settings').select('value').eq('key', 'botbhai_auto_sync').maybeSingle(),
          supabase.from('botbhai_order_links').select('order_id', { count: 'exact', head: true }).eq('direction', 'pushed'),
          supabase.from('botbhai_order_links').select('order_id', { count: 'exact', head: true }).eq('direction', 'imported'),
        ]);

        let connection: { ok: boolean; remoteProducts?: number; error?: string; code?: string | null } = {
          ok: false,
          error: 'BOTBHAI_API_KEY is not set',
          code: 'not_configured',
        };
        if (botbhaiConfigured()) {
          try {
            const { data } = await botbhai('GET', '/products?page=1&limit=1');
            connection = { ok: true, remoteProducts: Number(data?.meta?.total ?? 0) };
          } catch (err) {
            const e = err as BotbhaiError;
            connection = { ok: false, error: e.message, code: e.code ?? null };
          }
        }

        return json({
          configured: botbhaiConfigured(),
          autoSync: setting?.value === 'true',
          pushedOrders: pushed.count ?? 0,
          importedOrders: imported.count ?? 0,
          connection,
        });
      }

      case 'sync_products': {
        const offset = clampInt(body.offset, 0, 1_000_000, 0);
        const limit = clampInt(body.limit, 1, 50, 10);

        const { count, error: countError } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true });
        if (countError) throw countError;

        const { data, error } = await supabase
          .from('products')
          .select(PRODUCT_SELECT)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + limit - 1);
        if (error) throw error;

        const products = (data ?? []) as unknown as ProductRow[];
        const result = await pushProducts(products);
        const next = offset + products.length;

        return json({
          ...result,
          total: count ?? 0,
          processed: next,
          nextOffset: products.length === limit && next < (count ?? 0) ? next : null,
        });
      }

      case 'push_stock': {
        const ids = Array.isArray(body.productIds) ? body.productIds.map(String).slice(0, 100) : [];
        return json(await pushStock(supabase, ids));
      }

      case 'push_order': {
        if (typeof body.orderId !== 'string') return json({ error: 'orderId is required' }, 400);
        return json(await pushOrder(supabase, body.orderId));
      }

      case 'push_recent_orders': {
        const days = clampInt(body.days, 1, 30, 3);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const { data: orders, error } = await supabase
          .from('orders')
          .select('id, order_number')
          .gte('created_at', since)
          .neq('order_source', 'botbhai')
          .neq('status', 'cancelled')
          .order('created_at', { ascending: true });
        if (error) throw error;

        const ids = (orders ?? []).map((o) => o.id);
        const linked = new Set<string>();
        for (let i = 0; i < ids.length; i += 200) {
          const { data: links, error: linkError } = await supabase
            .from('botbhai_order_links')
            .select('order_id')
            .in('order_id', ids.slice(i, i + 200));
          if (linkError) throw linkError;
          (links ?? []).forEach((l: { order_id: string }) => linked.add(l.order_id));
        }

        const todo = (orders ?? []).filter((o) => !linked.has(o.id));
        const batch = todo.slice(0, 20);
        const results: Array<{ orderNumber: string; status: string; detail?: string }> = [];

        for (const o of batch) {
          try {
            const r = await pushOrder(supabase, o.id);
            results.push({
              orderNumber: o.order_number,
              status: r.status,
              detail: r.status === 'pushed' ? r.botbhaiOrderNumber : r.reason,
            });
          } catch (err) {
            results.push({ orderNumber: o.order_number, status: 'failed', detail: (err as Error).message });
          }
        }

        return json({ results, remaining: todo.length - batch.length });
      }

      case 'push_status': {
        const ids: string[] = Array.isArray(body.orderIds) ? body.orderIds.map(String).slice(0, 100) : [];
        const results: Array<{ orderId: string; status: string; detail?: string }> = [];

        for (const id of ids) {
          try {
            const r = await pushOrderStatus(supabase, id);
            results.push({
              orderId: id,
              status: r.status,
              detail: r.status === 'pushed' ? `${r.botbhaiOrderNumber}: ${r.steps.join(' -> ')}` : r.reason,
            });
          } catch (err) {
            results.push({ orderId: id, status: 'failed', detail: (err as Error).message });
          }
        }

        return json({ results });
      }

      case 'import_orders': {
        const days = clampInt(body.days, 1, 30, 3);
        return json(await importOrders(supabase, { days }));
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    if (err instanceof BotbhaiError) {
      console.error(`botbhai-sync ${action}: BotBhai ${err.status} ${err.code}: ${err.message}`);
      return json({ error: err.message, code: err.code }, 502);
    }
    console.error(`botbhai-sync ${action} failed:`, err);
    return json({ error: (err as Error)?.message ?? 'BotBhai sync failed' }, 500);
  }
});
