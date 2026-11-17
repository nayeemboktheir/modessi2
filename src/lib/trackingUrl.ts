// Where to send someone who clicks a parcel's tracking number.
//
// Steadfast returns its own tracking page with each booking (`tracking_link`,
// https://steadfast.com.bd/tl/<hash>), which steadfast-courier stores on the order. Orders booked
// before that column existed have only the code, so fall back on its shape: Steadfast codes on
// this account look like `SFR261116STE2C37A6BD` (older ones were all digits); anything else is a
// Carrybee consignment.

export function trackingUrl(order: { tracking_number?: string | null; tracking_link?: string | null }): string | null {
  if (order.tracking_link && /^https?:\/\//.test(order.tracking_link)) return order.tracking_link;
  const code = order.tracking_number?.trim();
  if (!code) return null;
  const encoded = encodeURIComponent(code);
  return /^\d+$/.test(code) || /^SFR/i.test(code)
    ? `https://steadfast.com.bd/t/${encoded}`
    : `https://merchant.carrybee.com/order-track/${encoded}`;
}
