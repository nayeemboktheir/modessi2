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
 * - A final outcome replaces a pending one (even if timestamps disagree,
 *   e.g. a cached status-API answer was stored a moment after the real event).
 * - A final outcome is replaced by a pending one only when Steadfast really reopened the
 *   parcel: both times known and the incoming event strictly newer. A late retry of an old
 *   event, or an answer with no time, cannot undo a final outcome.
 * - Otherwise (including one final outcome correcting another) the newer event wins;
 *   unknown times are treated as newer.
 * - The same status again is always applied: it changes nothing that could regress, and it is how
 *   the webhook's amounts (COD collected, delivery charge) land when a status-API poll already
 *   stored that status with a later "now" timestamp.
 */
export function shouldApply(stored: CourierState, incoming: CourierState): boolean {
  if (!incoming.status) return false;
  if (incoming.status === stored.status) return true;
  const storedOutcome = courierOutcome(stored.status);
  const incomingOutcome = courierOutcome(incoming.status);
  if (storedOutcome !== 'pending' && incomingOutcome === 'pending') {
    return stored.updatedAt != null && incoming.updatedAt != null && incoming.updatedAt > stored.updatedAt;
  }
  if (storedOutcome === 'pending' && incomingOutcome !== 'pending') return true;
  if (stored.updatedAt == null || incoming.updatedAt == null) return true;
  return incoming.updatedAt >= stored.updatedAt;
}

/** Order statuses the courier may move on: the parcel is still on its way. */
const IN_FLIGHT = new Set(['pending', 'processing', 'confirmed', 'shipped']);

/**
 * The order status a courier event leads to, or why it is left alone.
 * The courier moves an order that is still in flight, or one whose status is exactly what the
 * previous courier outcome would have set (so the webhook can correct its own earlier change).
 * Anything else was decided by an admin — cancelled, or delivered / returned by hand against
 * what Steadfast now says — and is kept, with the disagreement reported.
 */
export function nextOrderStatus(
  current: string,
  storedCourier: string | null,
  incomingCourier: string,
): { status: string | null; conflict?: string } {
  const implied = orderStatusFor(storedCourier); // what the courier set last time, if anything
  const ownedByCourier = implied != null && current === implied;
  const reopened = courierOutcome(storedCourier) !== 'pending' && courierOutcome(incomingCourier) === 'pending';

  // A reopened parcel goes back to 'shipped', but only if the courier put it where it is now.
  const target = reopened ? (ownedByCourier ? 'shipped' : null) : orderStatusFor(incomingCourier);
  if (!target || target === current) return { status: null };
  if (IN_FLIGHT.has(current) || ownedByCourier) return { status: target };
  return { status: null, conflict: `order is ${current}, Steadfast says ${incomingCourier}` };
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
  | { apply: true; update: Record<string, unknown>; outcome: CourierOutcome; conflict?: string }
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

  const givenTime = parseSteadfastTime(event.updated_at);
  const eventTime = givenTime ?? nowMs;
  const storedTime = stored.courier_status_updated_at
    ? Date.parse(stored.courier_status_updated_at)
    : null;

  // The event's own time, not "now", decides whether it may reopen a final parcel.
  const ok = shouldApply(
    { status: normalizeStatus(stored.courier_status), updatedAt: Number.isNaN(storedTime) ? null : storedTime },
    { status, updatedAt: givenTime },
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

  const next = nextOrderStatus(stored.status, normalizeStatus(stored.courier_status), status);
  if (next.status) update.status = next.status;

  return { apply: true, update, outcome: courierOutcome(status), conflict: next.conflict };
}

/** Constant-time string comparison for secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
