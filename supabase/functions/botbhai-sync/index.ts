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
      const res = await fetch(BOTBHAI_PRODUCTS_URL, { method: 'POST', headers, body: JSON.stringify(data) })
      const body = await res.text()
      return new Response(JSON.stringify({ ok: res.ok, status: res.status, body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ---------- delete_product ----------
    if (action === 'delete_product') {
      const res = await fetch(BOTBHAI_PRODUCTS_URL, { method: 'DELETE', headers, body: JSON.stringify({ id: data.id }) })
      const body = await res.text()
      return new Response(JSON.stringify({ ok: res.ok, status: res.status, body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ---------- sync_order ----------
    if (action === 'sync_order') {
      const res = await fetch(BOTBHAI_ORDERS_URL, { method: 'POST', headers, body: JSON.stringify(data) })
      const body = await res.text()
      return new Response(JSON.stringify({ ok: res.ok, status: res.status, body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ---------- delete_order ----------
    if (action === 'delete_order') {
      const res = await fetch(BOTBHAI_ORDERS_URL, { method: 'DELETE', headers, body: JSON.stringify({ id: data.id }) })
      const body = await res.text()
      return new Response(JSON.stringify({ ok: res.ok, status: res.status, body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ---------- sync_all_orders ----------
    if (action === 'sync_all_orders') {
      let ordersSynced = 0
      const errors: string[] = []

      const { data: ordersData, error: oErr } = await supabase
        .from('orders')
        .select('*, order_items(*)')

      if (oErr) {
        errors.push(`Order fetch error: ${oErr.message}`)
      } else if (ordersData) {
        for (const o of ordersData) {
          const payload = {
            order_id: o.order_number || o.id,
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
        message: `Synced ${ordersSynced} orders`,
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
