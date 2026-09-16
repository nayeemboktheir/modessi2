import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAdmin } from '../_shared/auth.ts';
import {
  getSteadfastCredentials,
  hasSteadfastCredentials,
  requestSteadfast,
  upstreamMessage,
} from '../_shared/steadfast.ts';

type LookupType = 'tracking_code' | 'invoice' | 'consignment_id';

interface StatusLookup {
  type: LookupType;
  value: string;
}

interface StatusRequest {
  // Backwards-compatible batch input used by the orders page.
  tracking_codes?: string[];
  invoices?: string[];
  consignment_ids?: Array<string | number>;
  // Explicit lookup input supports a mixed batch in a single request.
  lookups?: StatusLookup[];
}

interface SteadfastStatus {
  lookup_type: LookupType;
  lookup_value: string;
  tracking_code?: string;
  invoice?: string;
  consignment_id?: string;
  delivery_status?: string;
  current_status?: string;
  updated_at: string;
}

const MAX_LOOKUPS_PER_REQUEST = 40;

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function buildLookups(body: StatusRequest): StatusLookup[] {
  const candidates: StatusLookup[] = [
    ...(body.tracking_codes ?? []).map((value) => ({ type: 'tracking_code' as const, value: String(value) })),
    ...(body.invoices ?? []).map((value) => ({ type: 'invoice' as const, value: String(value) })),
    ...(body.consignment_ids ?? []).map((value) => ({ type: 'consignment_id' as const, value: String(value) })),
    ...(body.lookups ?? []),
  ];

  const seen = new Set<string>();
  return candidates.filter((lookup) => {
    const value = String(lookup.value ?? '').trim();
    if (!['tracking_code', 'invoice', 'consignment_id'].includes(lookup.type) || !value) return false;
    const key = `${lookup.type}:${value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    lookup.value = value;
    return true;
  });
}

function endpointFor(lookup: StatusLookup): string {
  const value = encodeURIComponent(lookup.value);
  switch (lookup.type) {
    case 'consignment_id': return `/status_by_cid/${value}`;
    case 'invoice': return `/status_by_invoice/${value}`;
    case 'tracking_code': return `/status_by_trackingcode/${value}`;
  }
}

function resultKey(lookup: StatusLookup): string {
  // Preserve the existing public result key for tracking-code callers.
  return lookup.type === 'tracking_code' ? lookup.value : `${lookup.type}:${lookup.value}`;
}

async function lookupStatus(
  lookup: StatusLookup,
  credentials: Awaited<ReturnType<typeof getSteadfastCredentials>>,
): Promise<{ key: string; value: SteadfastStatus | { error: string; upstream?: unknown } }> {
  try {
    const upstream = await requestSteadfast(endpointFor(lookup), credentials);
    const data = upstream.data as { status?: number; delivery_status?: unknown } | undefined;
    if (!upstream.ok || data?.status !== 200) {
      return {
        key: resultKey(lookup),
        value: { error: upstreamMessage(upstream.data, 'Failed to get delivery status'), upstream: upstream.data },
      };
    }

    const deliveryStatus = typeof data.delivery_status === 'string' ? data.delivery_status : undefined;
    return {
      key: resultKey(lookup),
      value: {
        lookup_type: lookup.type,
        lookup_value: lookup.value,
        ...(lookup.type === 'tracking_code' ? { tracking_code: lookup.value } : {}),
        ...(lookup.type === 'invoice' ? { invoice: lookup.value } : {}),
        ...(lookup.type === 'consignment_id' ? { consignment_id: lookup.value } : {}),
        delivery_status: deliveryStatus,
        current_status: deliveryStatus,
        updated_at: new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get delivery status';
    return { key: resultKey(lookup), value: { error: message } };
  }
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
      return json({ error: 'Steadfast credentials not configured' }, 500);
    }

    const body = await req.json() as StatusRequest;
    const requested = buildLookups(body);
    if (requested.length === 0) {
      return json({ error: 'Provide at least one tracking code, invoice, or consignment ID' }, 400);
    }

    const processedLookups = requested.slice(0, MAX_LOOKUPS_PER_REQUEST);
    const remaining = requested.slice(MAX_LOOKUPS_PER_REQUEST);
    const results: Record<string, SteadfastStatus | { error: string; upstream?: unknown }> = {};

    // Run serially with a small gap so a manual refresh cannot overwhelm the
    // courier API. The cap keeps the entire function within the worker timeout.
    for (const [index, lookup] of processedLookups.entries()) {
      const result = await lookupStatus(lookup, credentials);
      results[result.key] = result.value;
      if (index < processedLookups.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return json({
      success: true,
      results,
      processed: processedLookups.length,
      remaining_lookups: remaining,
      // Kept so the existing orders UI needs no change.
      remaining_tracking_codes: remaining
        .filter((lookup) => lookup.type === 'tracking_code')
        .map((lookup) => lookup.value),
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('steadfast-status failed:', message);
    return json({ error: message }, 500);
  }
});
