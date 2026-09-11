// Authorization helpers for edge functions.
//
// The router in `main/index.ts` only checks that the caller's JWT is *signed* by
// JWT_SECRET. The publishable anon key is exactly such a token and ships inside the
// browser bundle, so passing the router proves nothing about who the caller is.
// Anything that spends money, touches another customer's data, or runs with the
// service role must therefore authorize the caller itself, using this module.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

  return token.trim();
}

// Length-independent comparison so a wrong secret can't be recovered by timing.
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// True when the caller presented the service-role key, i.e. this is one of our own
// functions calling another (place-order -> send-sms / send-order-email). The key
// never leaves the server, so holding it is proof enough.
export function isInternalCall(req: Request): boolean {
  const token = getBearerToken(req);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !serviceKey) return false;

  return secretsMatch(token, serviceKey);
}

export type AdminCheck =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

/**
 * Resolve the caller and confirm they hold the `admin` role.
 * Returns the failing Response ready to be returned when they don't.
 */
export async function requireAdmin(req: Request): Promise<AdminCheck> {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, response: json({ error: 'Unauthorized' }, 401) };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('requireAdmin: server not configured');
    return { ok: false, response: json({ error: 'Server not configured' }, 500) };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The anon key is a valid JWT but carries no user, so this rejects it.
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { ok: false, response: json({ error: 'Unauthorized' }, 401) };
  }

  // maybeSingle, not single: a user may legitimately hold both 'user' and 'admin'
  // rows, and `single` would error on that instead of granting access.
  const { data: adminRole, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (roleError) {
    console.error('requireAdmin: role lookup failed:', roleError.message);
    return { ok: false, response: json({ error: 'Authorization check failed' }, 500) };
  }

  if (!adminRole) {
    return { ok: false, response: json({ error: 'Admin access required' }, 403) };
  }

  return { ok: true, userId: user.id };
}

/**
 * For functions that are called both by an admin from the browser and by another
 * one of our functions server-to-server.
 */
export async function requireAdminOrInternal(req: Request): Promise<AdminCheck> {
  if (isInternalCall(req)) {
    return { ok: true, userId: 'service_role' };
  }
  return await requireAdmin(req);
}

/** Best-effort admin check that never throws — for optional privilege escalation. */
export async function callerIsAdmin(req: Request): Promise<boolean> {
  try {
    const result = await requireAdmin(req);
    return result.ok;
  } catch (err) {
    console.error('callerIsAdmin failed:', err);
    return false;
  }
}
