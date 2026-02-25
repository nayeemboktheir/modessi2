import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const BOTBHAI_PRODUCTS_URL = 'https://chat.botbhai.net/api/v1/external/products'
const BOTBHAI_ORDERS_URL = 'https://chat.botbhai.net/api/v1/external/orders'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch BotBhai API key
    const { data: settingRow, error: settingErr } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'botbhai_api_key')
      .single()

    if (settingErr || !settingRow?.value) {
      return new Response(JSON.stringify({ error: 'BotBhai API key not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = settingRow.value
    const headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey }

    const { action, data } = await req.json()

    // ---------- sync_product ----------
    if (action === 'sync_product') {
      const res = await fetch(BOTBHAI_PRODUCTS_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      })
      const body = await res.text()
      return new Response(JSON.stringify({ ok: res.ok, status: res.status, body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ---------- delete_product ----------
    if (action === 'delete_product') {
      const res = await fetch(BOTBHAI_PRODUCTS_URL, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ id: data.id }),
      })
      const body = await res.text()
      return new Response(JSON.stringify({ ok: res.ok, status: res.status, body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ---------- sync_order ----------
    if (action === 'sync_order') {
      const res = await fetch(BOTBHAI_ORDERS_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      })
      const body = await res.text()
      return new Response(JSON.stringify({ ok: res.ok, status: res.status, body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ---------- delete_order ----------
    if (action === 'delete_order') {
      const res = await fetch(BOTBHAI_ORDERS_URL, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ id: data.id }),
      })
      const body = await res.text()
      return new Response(JSON.stringify({ ok: res.ok, status: res.status, body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ---------- sync_all ----------
    if (action === 'sync_all') {
      let productsSynced = 0
      let ordersSynced = 0
      const errors: string[] = []

      // Sync all active products
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('is_active', true)

      if (pErr) {
        errors.push(`Product fetch error: ${pErr.message}`)
      } else if (products) {
        for (const p of products) {
          const stock = p.stock ?? 0
          const payload = {
            product_id: p.id,
            product_name: p.name,
            image_url: p.images?.[0] || null,
            images: p.images || null,
            category: (p.categories as any)?.name || null,
            subcategory: null,
            tags: p.tags || null,
            color: null,
            size: null,
            stock,
            stock_status: stock <= 0 ? 'out_of_stock' : stock < 10 ? 'low_stock' : 'in_stock',
            base_price: p.original_price ?? p.price ?? 0,
            selling_price: p.price ?? 0,
            discount_price: p.original_price && p.original_price > p.price ? p.price : null,
            wholesale_price: null,
            description: p.description || null,
            features: null,
            is_available: p.is_active ?? true,
            status: p.is_active === false ? 'inactive' : 'active',
          }
          try {
            const res = await fetch(BOTBHAI_PRODUCTS_URL, { method: 'POST', headers, body: JSON.stringify(payload) })
            if (res.ok) productsSynced++
            else errors.push(`Product ${p.id}: ${res.status}`)
          } catch (e) {
            errors.push(`Product ${p.id}: ${e}`)
          }
        }
      }

      // Sync all orders
      const { data: ordersData, error: oErr } = await supabase
        .from('orders')
        .select('*, order_items(*)')

      if (oErr) {
        errors.push(`Order fetch error: ${oErr.message}`)
      } else if (ordersData) {
        for (const o of ordersData) {
          const payload = {
            order_id: o.id,
            customer_id: o.shipping_phone || o.id,
            customer_name: o.shipping_name || null,
            customer_phone: o.shipping_phone || null,
            customer_email: null,
            customer_address: [o.shipping_street, o.shipping_city, o.shipping_district].filter(Boolean).join(', ') || null,
            items: (o.order_items || []).map((i: any) => ({
              product_id: i.product_id || '',
              qty: i.quantity,
              price: Number(i.price),
            })),
            subtotal: Number(o.subtotal) || 0,
            delivery_charge: Number(o.shipping_cost) || 0,
            discount: Number(o.discount) || 0,
            total: Number(o.total) || 0,
            status: o.status || 'pending',
            payment_method: o.payment_method || null,
            payment_status: o.payment_status || 'unpaid',
            paid_amount: o.payment_status === 'paid' ? Number(o.total) || 0 : 0,
            customer_notes: o.notes || null,
          }
          try {
            const res = await fetch(BOTBHAI_ORDERS_URL, { method: 'POST', headers, body: JSON.stringify(payload) })
            if (res.ok) ordersSynced++
            else errors.push(`Order ${o.id}: ${res.status}`)
          } catch (e) {
            errors.push(`Order ${o.id}: ${e}`)
          }
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        message: `Synced ${productsSynced} products and ${ordersSynced} orders`,
        errors: errors.length > 0 ? errors : undefined,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('botbhai-sync error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
