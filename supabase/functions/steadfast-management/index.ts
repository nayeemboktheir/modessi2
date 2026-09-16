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
  | 'get_police_stations';

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
]);

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
  const payload: Record<string, string> = { [key]: String(rawValue).trim() };
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

    const request = requestFor(body);
    if ('error' in request) return json(request, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const credentials = await getSteadfastCredentials(supabase);
    if (!hasSteadfastCredentials(credentials)) {
      return json({ error: 'Steadfast credentials not configured. Please add them in Admin → Steadfast settings.' }, 500);
    }

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
