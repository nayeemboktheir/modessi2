// What Modessi owes a reseller (partner) such as Maxora Outlet. Modessi ships the partner's
// orders and collects their COD, so the partner's money sits here until Modessi pays it over.
// Per parcel:
//
//   delivered           collected − wholesale − delivery charge
//   partly delivered    same, flagged for checking (some items came back)
//   returned/cancelled  − delivery charge (the goods come back to Modessi, so no wholesale)
//   on the way          not counted yet
//
// Balance = Σ counted − Σ partner_payments. Positive = Modessi owes the partner.
// The partner's admin uses the same rules (Maxora repo: src/lib/modessiSettlement.ts).

export interface PartnerParcel {
  status: string; // Modessi order status
  cod_amount: number | null;
  wholesale_total: number | null;
  courier_status: string | null;
  courier_cod_amount: number | null;
  courier_delivery_charge: number | null;
}

export interface ParcelSettlement {
  status: 'delivered' | 'returned' | 'pending' | 'not_shipped';
  owed: number | null;
  expected: number | null;
  estimated: boolean;
  review: boolean;
}

/** Delivery charge to assume until Steadfast reports the real one. */
export const DEFAULT_DELIVERY_CHARGE = 130;

function courierOutcome(status: string | null): 'delivered' | 'cancelled' | 'pending' {
  if (!status) return 'pending';
  if (status.endsWith('_approval_pending')) return 'pending';
  if (status === 'delivered' || status.startsWith('partial_delivered')) return 'delivered';
  if (status.startsWith('cancelled')) return 'cancelled';
  return 'pending';
}

export function settleParcel(p: PartnerParcel): ParcelSettlement {
  if (p.status === 'cancelled' && !p.courier_status) {
    return { status: 'not_shipped', owed: null, expected: null, estimated: false, review: false };
  }
  const courier = p.courier_status?.toLowerCase() ?? null;
  const outcome = courierOutcome(courier);
  const estimated = p.courier_delivery_charge == null;
  const charge = Number(p.courier_delivery_charge ?? DEFAULT_DELIVERY_CHARGE);
  const wholesale = p.wholesale_total == null ? null : Number(p.wholesale_total);

  if (outcome === 'cancelled') return { status: 'returned', owed: -charge, expected: null, estimated, review: false };
  if (outcome === 'delivered') {
    const collected = Number(p.courier_cod_amount ?? p.cod_amount ?? 0);
    return {
      status: 'delivered',
      owed: wholesale == null ? null : collected - wholesale - charge,
      expected: null,
      estimated,
      review: !!courier?.startsWith('partial_delivered') || wholesale == null,
    };
  }
  return {
    status: 'pending',
    owed: null,
    expected: wholesale == null ? null : Number(p.cod_amount ?? 0) - wholesale - charge,
    estimated: true,
    review: false,
  };
}

export function settlementTotals(parcels: PartnerParcel[], payments: { amount: number }[]) {
  const t = {
    earned: 0,
    paid: payments.reduce((s, p) => s + Number(p.amount), 0),
    balance: 0,
    pending: 0,
    delivered: 0,
    returned: 0,
    onTheWay: 0,
    review: 0,
    estimated: false,
  };
  for (const p of parcels) {
    const s = settleParcel(p);
    if (s.status === 'delivered') t.delivered++;
    if (s.status === 'returned') t.returned++;
    if (s.status === 'pending') {
      t.onTheWay++;
      t.pending += s.expected ?? 0;
    }
    if (s.owed != null) {
      t.earned += s.owed;
      t.estimated ||= s.estimated;
    }
    if (s.review) t.review++;
  }
  t.balance = t.earned - t.paid;
  return t;
}
