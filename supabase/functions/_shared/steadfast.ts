// Shared Steadfast Courier API client. Credentials only ever leave the server in
// the headers of a request to portal.packzy.com.

const BASE_URL = 'https://portal.packzy.com/api/v1';
const DEFAULT_TIMEOUT_MS = 20_000;

export interface SteadfastCredentials {
  apiKey: string;
  secretKey: string;
}

export interface SteadfastResponse {
  ok: boolean;
  status: number;
  data: unknown;
}

export async function getSteadfastCredentials(
  supabase: { from: (table: string) => any },
): Promise<SteadfastCredentials> {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('key, value')
    .in('key', ['steadfast_api_key', 'steadfast_secret_key']);

  if (error) {
    console.error('Could not read Steadfast credentials:', error.message);
  }

  let apiKey = '';
  let secretKey = '';
  for (const setting of data ?? []) {
    if (setting.key === 'steadfast_api_key') apiKey = String(setting.value ?? '').trim();
    if (setting.key === 'steadfast_secret_key') secretKey = String(setting.value ?? '').trim();
  }

  if (!apiKey) apiKey = (Deno.env.get('STEADFAST_API_KEY') ?? '').trim();
  if (!secretKey) secretKey = (Deno.env.get('STEADFAST_SECRET_KEY') ?? '').trim();

  return { apiKey, secretKey };
}

export function hasSteadfastCredentials(credentials: SteadfastCredentials): boolean {
  return Boolean(credentials.apiKey && credentials.secretKey);
}

/**
 * Make one bounded request to the Steadfast API and preserve its response body.
 * Callers can pass an already encoded path segment, but query values must be
 * encoded by the caller with URLSearchParams.
 */
export async function requestSteadfast(
  path: string,
  credentials: SteadfastCredentials,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SteadfastResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Api-Key': credentials.apiKey,
        'Secret-Key': credentials.secretKey,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

export function upstreamMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
