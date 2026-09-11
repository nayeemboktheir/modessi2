// Rate limiting for the endpoints that cannot use a role check.
//
// place-order and the three ad-pixel forwarders are called by anonymous shoppers,
// so the only thing standing between them and a script is a request budget. Every
// request runs in a freshly spawned worker, so the counter lives in Postgres
// (public.rate_limit_hits, incremented through the rate_limit_hit function).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
}

/**
 * Returns true when the caller is still within its budget.
 * Fails open: if the counter itself errors we would rather take the order than
 * lose it, and the error is logged.
 */
export async function withinRateLimit(
  bucket: string,
  identifier: string,
  windowSeconds: number,
  limit: number,
): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    console.error('withinRateLimit: server not configured');
    return true;
  }

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.rpc('rate_limit_hit', {
      p_bucket: bucket,
      p_identifier: identifier,
      p_window_seconds: windowSeconds,
      p_limit: limit,
    });

    if (error) {
      console.error('withinRateLimit: counter failed:', error.message);
      return true;
    }

    return data !== false;
  } catch (err) {
    console.error('withinRateLimit: counter threw:', err);
    return true;
  }
}

export function tooManyRequests(corsHeaders: Record<string, string>, retryAfterSeconds: number) {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    },
  );
}
