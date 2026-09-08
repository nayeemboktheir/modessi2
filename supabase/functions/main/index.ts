// Router for self-hosted Supabase Edge Runtime.
//
// On Supabase Cloud each function is deployed and routed individually. Self-hosted,
// the `supabase/edge-runtime` container runs THIS file as a single long-lived main
// worker; it receives every request and spawns a short-lived user worker for the
// target function. Kong strips the `/functions/v1` prefix before proxying, so the
// first path segment here is the function name.
//
// The functions in the sibling directories need no changes: each still calls
// `Deno.serve(...)` at its top level, which is exactly what a user worker expects.
//
// Deploying: copy this directory plus every function directory into the container's
// /home/deno/functions mount. Edits to a function are picked up on the next request;
// edits to THIS file need a container restart, because it is the long-running process.

import * as jose from 'https://deno.land/x/jose@v5.9.6/index.ts';

// Provided by the edge runtime at execution time; not part of Deno's own types.
declare const EdgeRuntime: {
  userWorkers: {
    create(opts: {
      servicePath: string;
      memoryLimitMb: number;
      workerTimeoutMs: number;
      noModuleCache: boolean;
      importMapPath: string | null;
      envVars: string[][];
    }): Promise<{ fetch(req: Request): Promise<Response> }>;
  };
};

const JWT_SECRET = Deno.env.get('JWT_SECRET') ?? '';

// Global default, mirroring the container's FUNCTIONS_VERIFY_JWT env var.
const VERIFY_JWT = (Deno.env.get('FUNCTIONS_VERIFY_JWT') ?? 'true') !== 'false';

// Per-function opt-out, the self-hosted equivalent of `verify_jwt = false` in
// supabase/config.toml (which only the Supabase CLI/Cloud reads). Overridable via
// env so this list can change without editing and restarting the router.
const PUBLIC_FUNCTIONS = new Set(
  (Deno.env.get('FUNCTIONS_NO_VERIFY_JWT') ?? 'tiktok-events-api')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean),
);

// place-order defers SMS, courier and ad-pixel work to EdgeRuntime.waitUntil after
// responding, so the worker has to outlive the response it already sent.
const WORKER_TIMEOUT_MS = 150_000;
const MEMORY_LIMIT_MB = 256;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function isAuthorized(req: Request): Promise<boolean> {
  const header = req.headers.get('authorization');
  if (!header) return false;

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return false;

  try {
    await jose.jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    return true;
  } catch (err) {
    console.error('JWT verification failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const { pathname } = new URL(req.url);

  if (pathname === '/' || pathname === '/_internal/health') {
    return json({ status: 'ok' }, 200);
  }

  const functionName = pathname.split('/')[1];
  if (!functionName) {
    return json({ error: 'Missing function name in request path' }, 400);
  }

  // CORS preflight carries no Authorization header by design. Each function returns
  // its own CORS headers, so hand OPTIONS straight to the worker rather than 401ing
  // the browser before the real request is ever made.
  const needsAuth = VERIFY_JWT && req.method !== 'OPTIONS' && !PUBLIC_FUNCTIONS.has(functionName);

  if (needsAuth && !(await isAuthorized(req))) {
    return json({ error: 'Missing or invalid authorization token' }, 401);
  }

  const envVars = Object.entries(Deno.env.toObject());

  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath: `/home/deno/functions/${functionName}`,
      memoryLimitMb: MEMORY_LIMIT_MB,
      workerTimeoutMs: WORKER_TIMEOUT_MS,
      noModuleCache: false,
      importMapPath: null,
      envVars,
    });

    return await worker.fetch(req);
  } catch (err) {
    console.error(`Failed to invoke function "${functionName}":`, err);
    return json({ error: `Failed to invoke function: ${functionName}` }, 500);
  }
});
