// Shared Steadfast delivery-status rules, used by both the webhook receiver
// (steadfast-webhook) and the manual sync (steadfast-status).
//
// Pure functions only (no Deno / network APIs) so they can be unit-tested.

export type CourierOutcome = 'delivered' | 'cancelled' | 'pending';

export interface CourierState {
  status: string | null;
  /** Epoch milliseconds of the event, or null when unknown. */
  updatedAt: number | null;
}

/** Lower-cased, trimmed status string, or null for empty / non-string input. */
export function normalizeStatus(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  return s || null;
}

/**
 * How the shop treats a Steadfast status.
 *
 * Final: delivered, partial_delivered, cancelled, plus their return-progress
 * variants from the status API (e.g. cancelled_return_received).
 * `*_approval_pending` means the rider reported it but Steadfast has not
 * approved it yet, so it is still pending.
 */
export function courierOutcome(status: string | null): CourierOutcome {
  if (!status) return 'pending';
  if (status.endsWith('_approval_pending')) return 'pending';
  if (status === 'delivered' || status.startsWith('partial_delivered')) return 'delivered';
  if (status.startsWith('cancelled')) return 'cancelled';
  return 'pending';
}

/** orders.status for a final courier outcome, or null to leave it unchanged. */
export function orderStatusFor(status: string | null): 'delivered' | 'returned' | null {
  const outcome = courierOutcome(status);
  if (outcome === 'delivered') return 'delivered';
  if (outcome === 'cancelled') return 'returned';
  return null;
}

/** Number or numeric string → number; anything else → null. */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Steadfast timestamps usually look like "2026-11-15 14:30:00" with no zone;
 * those are Bangladesh time (UTC+6). ISO strings with a zone are used as-is.
 * Returns epoch ms, or null if it cannot be parsed.
 */
export function parseSteadfastTime(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim();
  const naive = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
  const iso = naive.test(s) ? `${s.replace(' ', 'T')}+06:00` : s;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Whether an incoming status should overwrite the stored one.
 * - A final outcome is never replaced by a pending one.
 * - A final outcome always replaces a pending one (even if timestamps disagree,
 *   e.g. a cached status-API answer was stored a moment after the real event).
 * - Otherwise the newer event wins; unknown times are treated as newer.
 */
export function shouldApply(stored: CourierState, incoming: CourierState): boolean {
  if (!incoming.status) return false;
  const storedOutcome = courierOutcome(stored.status);
  const incomingOutcome = courierOutcome(incoming.status);
  if (storedOutcome !== 'pending' && incomingOutcome === 'pending') return false;
  if (storedOutcome === 'pending' && incomingOutcome !== 'pending') return true;
  if (stored.updatedAt == null || incoming.updatedAt == null) return true;
  return incoming.updatedAt >= stored.updatedAt;
}

export interface StoredOrderCourier {
  status: string;
  courier_status: string | null;
  courier_status_updated_at: string | null;
}

export interface CourierEvent {
  status: unknown;
  cod_amount?: unknown;
  delivery_charge?: unknown;
  updated_at?: unknown;
}

export type CourierUpdateResult =
  | { apply: true; update: Record<string, unknown>; outcome: CourierOutcome }
  | { apply: false; reason: string };

/**
 * Turn a Steadfast status event into the `orders` update to write.
 * Amounts that are missing are left untouched rather than overwritten with null.
 */
export function buildCourierUpdate(
  stored: StoredOrderCourier,
  event: CourierEvent,
  nowMs: number,
): CourierUpdateResult {
  const status = normalizeStatus(event.status);
  if (!status) return { apply: false, reason: 'missing status' };

  const eventTime = parseSteadfastTime(event.updated_at) ?? nowMs;
  const storedTime = stored.courier_status_updated_at
    ? Date.parse(stored.courier_status_updated_at)
    : null;

  const ok = shouldApply(
    { status: normalizeStatus(stored.courier_status), updatedAt: Number.isNaN(storedTime) ? null : storedTime },
    { status, updatedAt: eventTime },
  );
  if (!ok) return { apply: false, reason: 'stale or regressing event' };

  const update: Record<string, unknown> = {
    courier_status: status,
    courier_status_updated_at: new Date(eventTime).toISOString(),
  };
  const cod = parseAmount(event.cod_amount);
  if (cod !== null) update.courier_cod_amount = cod;
  const charge = parseAmount(event.delivery_charge);
  if (charge !== null) update.courier_delivery_charge = charge;

  const orderStatus = orderStatusFor(status);
  if (orderStatus && orderStatus !== stored.status) update.status = orderStatus;

  return { apply: true, update, outcome: courierOutcome(status) };
}

/** Constant-time string comparison for secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
