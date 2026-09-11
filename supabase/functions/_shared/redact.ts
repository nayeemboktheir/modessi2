// Log redaction helpers.
//
// Edge-runtime logs are retained and readable by anyone with container or Studio
// access, so they are the wrong place for customer phone numbers, names and
// addresses. These keep logs useful for tracing a specific request without storing
// the identity itself.

/** 01712345678 -> 017****5678 — enough to correlate, not enough to contact. */
export function maskPhone(phone: unknown): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 7) return '***';

  return `${digits.slice(0, 3)}${'*'.repeat(digits.length - 7)}${digits.slice(-4)}`;
}

/** Reports which identifying fields were present, never their values. */
export function describeUserData(userData: Record<string, unknown> | undefined | null): string {
  if (!userData) return 'none';

  const present = Object.entries(userData)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key]) => key);

  return present.length > 0 ? present.join(',') : 'none';
}

/**
 * Escape text destined for an HTML email body. Order fields are customer-supplied,
 * so interpolating them raw let a customer inject markup into the notification the
 * shop's staff open.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
