import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Handshake, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { settleParcel, settlementTotals } from '@/lib/partnerSettlement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Admin → Partner Orders: orders resellers (e.g. Maxora Outlet) sent through partner-api,
// which Modessi packs, ships and collects COD for, and the running balance with each partner:
// what Modessi owes them for delivered parcels minus what it has paid (partner_payments).
// The partner sees the same figures on its own admin.

interface LinkRow {
  partner: string;
  partner_order_number: string | null;
  cod_amount: number | null;
  wholesale_total: number | null;
  created_at: string;
  updated_at: string | null;
  orders: {
    id: string;
    order_number: string;
    status: string;
    shipping_name: string;
    courier_status: string | null;
    courier_cod_amount: number | null;
    courier_delivery_charge: number | null;
    tracking_number: string | null;
  } | null;
}

interface Payment {
  id: string;
  partner: string;
  amount: number;
  paid_at: string;
  note: string | null;
  recorded_by: string;
}

const formatTk = (value: number | null | undefined) => {
  if (value == null) return '—';
  const rounded = Math.round(value);
  const abs = Math.abs(rounded).toLocaleString('en-US');
  return rounded < 0 ? `-৳${abs}` : `৳${abs}`;
};

const parcelOf = (r: LinkRow) => ({
  status: r.orders?.status ?? 'pending',
  cod_amount: r.cod_amount,
  wholesale_total: r.wholesale_total,
  courier_status: r.orders?.courier_status ?? null,
  courier_cod_amount: r.orders?.courier_cod_amount ?? null,
  courier_delivery_charge: r.orders?.courier_delivery_charge ?? null,
});

export default function AdminPartnerOrders() {
  const queryClient = useQueryClient();
  const [partner, setPartner] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const linksQuery = useQuery({
    queryKey: ['partner-order-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_order_links' as never)
        .select(
          'partner, partner_order_number, cod_amount, wholesale_total, created_at, updated_at, orders(id, order_number, status, shipping_name, courier_status, courier_cod_amount, courier_delivery_charge, tracking_number)',
        )
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as LinkRow[];
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ['partner-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_payments' as never)
        .select('id, partner, amount, paid_at, note, recorded_by')
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Payment[];
    },
  });

  const partners = useMemo(
    () => Array.from(new Set((linksQuery.data ?? []).map((r) => r.partner))).sort(),
    [linksQuery.data],
  );
  const current = partner ?? partners[0] ?? null;
  const rows = useMemo(() => (linksQuery.data ?? []).filter((r) => r.partner === current), [linksQuery.data, current]);
  const payments = useMemo(() => (paymentsQuery.data ?? []).filter((p) => p.partner === current), [paymentsQuery.data, current]);
  const totals = useMemo(() => settlementTotals(rows.map(parcelOf), payments), [rows, payments]);

  const reload = () => queryClient.invalidateQueries({ queryKey: ['partner-payments'] });

  const addPayment = async () => {
    const value = Number(amount);
    if (!current || !Number.isFinite(value) || value === 0) {
      toast.error('Enter the amount paid');
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from('partner_payments' as never)
      .insert({ partner: current, amount: value, paid_at: paidAt, note: note.trim() || null, recorded_by: 'modessi' } as never);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Payment of ${formatTk(value)} to ${current} recorded`);
    setAmount('');
    setNote('');
    reload();
  };

  const removePayment = async (p: Payment) => {
    if (!confirm(`Delete the ${formatTk(p.amount)} payment of ${p.paid_at}?`)) return;
    const { error } = await supabase.from('partner_payments' as never).delete().eq('id', p.id);
    if (error) toast.error(error.message);
    else reload();
  };

  const error = linksQuery.error ?? paymentsQuery.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Partner Orders</h1>
        <p className="text-muted-foreground">Orders resellers send to Modessi to ship, and what Modessi owes them</p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          {(error as Error).message}. Run supabase/migrations/20261116120000_partner_order_links.sql and
          20261116130000_partner_settlement.sql if you have not yet.
        </p>
      ) : linksQuery.isLoading || paymentsQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : partners.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No partner orders yet.</p>
      ) : (
        <>
          {partners.length > 1 && (
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 self-start w-fit">
              {partners.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPartner(p)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium capitalize',
                    p === current ? 'bg-background shadow-sm' : 'text-muted-foreground',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 capitalize">
                <Wallet className="h-5 w-5" />
                Balance with {current}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Per delivered parcel Modessi owes the partner what it collected minus wholesale and delivery; a returned
                parcel's delivery charge is the partner's.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">{totals.balance >= 0 ? 'Modessi owes them' : 'They owe Modessi'}</div>
                  <div className="text-2xl font-semibold tabular-nums">{formatTk(Math.abs(totals.balance))}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Earned on finished parcels</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {totals.estimated && '~'}
                    {formatTk(totals.earned)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {totals.delivered} delivered, {totals.returned} returned
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Paid</div>
                  <div className="text-2xl font-semibold tabular-nums">{formatTk(totals.paid)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Still on the way</div>
                  <div className="text-2xl font-semibold tabular-nums text-muted-foreground">~{formatTk(totals.pending)}</div>
                  <div className="text-xs text-muted-foreground">{totals.onTheWay} parcels, not counted yet</div>
                </div>
              </div>
              {(totals.estimated || totals.review > 0) && (
                <p className="text-xs text-muted-foreground">
                  {totals.estimated && '~ Some parcels use an estimated ৳130 delivery charge until Steadfast reports the real one (set up the Steadfast webhook). '}
                  {totals.review > 0 && `${totals.review} parcel${totals.review === 1 ? ' needs' : 's need'} a check (partly delivered or no wholesale price).`}
                </p>
              )}

              <div className="space-y-3">
                <div className="text-sm font-medium">Payments</div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="partner-pay-amount">Amount (৳)</Label>
                    <Input id="partner-pay-amount" type="number" className="w-full sm:w-36" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="partner-pay-date">Date</Label>
                    <Input id="partner-pay-date" type="date" className="w-full sm:w-40" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="partner-pay-note">Note</Label>
                    <Input id="partner-pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="bKash, bank transfer…" />
                  </div>
                  <Button onClick={addPayment} disabled={busy || !amount}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Record payment
                  </Button>
                </div>
                {payments.length > 0 && (
                  <div className="divide-y rounded-md border text-sm">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                        <span className="w-24 tabular-nums text-muted-foreground">{p.paid_at}</span>
                        <span className="w-24 font-medium tabular-nums">{formatTk(p.amount)}</span>
                        <span className="flex-1 truncate text-muted-foreground">{p.note}</span>
                        <span className="text-xs text-muted-foreground">{p.recorded_by === 'partner' ? 'by partner' : 'by Modessi'}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removePayment(p)} aria-label="Delete payment">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Handshake className="h-5 w-5" />
                Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modessi #</TableHead>
                    <TableHead>Partner #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead className="text-right">Collect</TableHead>
                    <TableHead className="text-right">Wholesale</TableHead>
                    <TableHead className="text-right">Delivery</TableHead>
                    <TableHead className="text-right">Owed to partner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const s = settleParcel(parcelOf(r));
                    return (
                      <TableRow key={r.orders?.id ?? r.partner_order_number}>
                        <TableCell className="font-medium">
                          #{r.orders?.order_number ?? '—'}
                          <div className="text-xs font-normal text-muted-foreground">{format(new Date(r.created_at), 'dd MMM')}</div>
                        </TableCell>
                        <TableCell>
                          {r.partner_order_number ?? '—'}
                          {r.updated_at && <div className="text-xs text-muted-foreground">changed {format(new Date(r.updated_at), 'dd MMM HH:mm')}</div>}
                        </TableCell>
                        <TableCell>{r.orders?.shipping_name ?? '—'}</TableCell>
                        <TableCell className="capitalize">{r.orders?.status ?? '—'}</TableCell>
                        <TableCell>
                          <div className="capitalize">{r.orders?.courier_status?.replace(/_/g, ' ') ?? '—'}</div>
                          {r.orders?.tracking_number && <div className="text-xs text-muted-foreground">{r.orders.tracking_number}</div>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatTk(r.orders?.courier_cod_amount ?? r.cod_amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatTk(r.wholesale_total)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatTk(r.orders?.courier_delivery_charge)}</TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums font-medium',
                            s.owed == null ? 'text-muted-foreground' : s.owed >= 0 ? 'text-green-600' : 'text-destructive',
                          )}
                        >
                          {s.owed != null ? `${s.estimated ? '~' : ''}${formatTk(s.owed)}` : s.expected != null ? `(~${formatTk(s.expected)})` : '—'}
                          {s.review && <div className="text-xs font-normal text-amber-600">check</div>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
