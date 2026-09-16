import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, Landmark, Loader2, MapPinned, PackageSearch, ReceiptText, RotateCcw, Search, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type StatusIdentifier = 'tracking_code' | 'invoice' | 'consignment_id';
type ManagementAction =
  | 'get_balance'
  | 'create_return_request'
  | 'get_return_request'
  | 'get_return_requests'
  | 'get_payments'
  | 'get_payment'
  | 'get_police_stations';

interface OperationResult {
  title: string;
  value: unknown;
}

type ReturnRequestRecord = Record<string, unknown>;

const identifierLabels: Record<StatusIdentifier, string> = {
  tracking_code: 'Tracking code',
  invoice: 'Invoice',
  consignment_id: 'Consignment ID',
};

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is ReturnRequestRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractReturnRequests(value: unknown, depth = 0): ReturnRequestRecord[] {
  if (depth > 3) return [];
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];

  // Steadfast may return a plain array or wrap its paginated array in one or
  // more of these keys. Handle both without tying the UI to one response shape.
  for (const key of ['data', 'return_requests', 'returns', 'requests', 'items']) {
    if (!(key in value)) continue;
    const records = extractReturnRequests(value[key], depth + 1);
    if (records.length > 0 || Array.isArray(value[key])) return records;
  }

  return 'id' in value ? [value] : [];
}

function textValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'object') return prettyJson(value);
  return String(value);
}

function formatDate(value: unknown): string {
  if (!value) return '-';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export default function AdminSteadfast() {
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<StatusIdentifier>('tracking_code');
  const [statusValue, setStatusValue] = useState('');
  const [returnIdentifierType, setReturnIdentifierType] = useState<StatusIdentifier>('tracking_code');
  const [returnIdentifierValue, setReturnIdentifierValue] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnRequestId, setReturnRequestId] = useState('');
  const [returnsOpen, setReturnsOpen] = useState(false);
  const [returnRequests, setReturnRequests] = useState<ReturnRequestRecord[]>([]);
  const [returnsResponse, setReturnsResponse] = useState<unknown>(null);
  const [paymentId, setPaymentId] = useState('');
  const [lastResult, setLastResult] = useState<OperationResult | null>(null);

  const invokeManagement = async (action: ManagementAction, payload: Record<string, unknown> = {}) => {
    setActiveOperation(action);
    try {
      const { data, error } = await supabase.functions.invoke('steadfast-management', {
        body: { action, ...payload },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Steadfast request failed');
      return data.data;
    } finally {
      setActiveOperation(null);
    }
  };

  const withResult = async (title: string, task: () => Promise<unknown>) => {
    try {
      const value = await task();
      if (title === 'Return requests') {
        setReturnRequests(extractReturnRequests(value));
        setReturnsResponse(value);
        setReturnsOpen(true);
        return;
      }
      setLastResult({ title, value });
      toast.success(`${title} loaded`);
    } catch (error) {
      console.error(`Steadfast ${title} failed:`, error);
      toast.error(error instanceof Error ? error.message : `Could not load ${title}`);
    }
  };

  const checkStatus = async () => {
    const value = statusValue.trim();
    if (!value) return toast.error(`Enter a ${identifierLabels[statusType].toLowerCase()}`);

    setActiveOperation('status');
    try {
      const { data, error } = await supabase.functions.invoke('steadfast-status', {
        body: { lookups: [{ type: statusType, value }] },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Steadfast status request failed');

      const key = statusType === 'tracking_code' ? value : `${statusType}:${value}`;
      setLastResult({ title: 'Delivery status', value: data.results?.[key] ?? data });
      toast.success('Delivery status loaded');
    } catch (error) {
      console.error('Steadfast status lookup failed:', error);
      toast.error(error instanceof Error ? error.message : 'Could not load delivery status');
    } finally {
      setActiveOperation(null);
    }
  };

  const createReturnRequest = async () => {
    const value = returnIdentifierValue.trim();
    if (!value) return toast.error(`Enter a ${identifierLabels[returnIdentifierType].toLowerCase()}`);

    await withResult('Return request', () => invokeManagement('create_return_request', {
      [returnIdentifierType]: value,
      reason: returnReason.trim() || undefined,
    }));
  };

  const loadReturnRequests = async () => {
    try {
      const value = await invokeManagement('get_return_requests');
      setReturnRequests(extractReturnRequests(value));
      setReturnsResponse(value);
      setReturnsOpen(true);
    } catch (error) {
      console.error('Steadfast return requests failed:', error);
      toast.error(error instanceof Error ? error.message : 'Could not load return requests');
    }
  };

  const isRunning = (operation: string) => activeOperation === operation;
  const BusyIcon = () => <Loader2 className="mr-2 h-4 w-4 animate-spin" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-display font-bold">
          <PackageSearch className="h-8 w-8" />
          Steadfast Operations
        </h1>
        <p className="text-muted-foreground">Manage balances, delivery status, returns, payments, and police stations.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" />Current balance</CardTitle>
            <CardDescription>Retrieve the balance from your Steadfast merchant account.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <Button onClick={() => withResult('Current balance', async () => {
              const data = await invokeManagement('get_balance');
              const current = data && typeof data === 'object' ? (data as { current_balance?: unknown }).current_balance : undefined;
              setBalance(current === undefined ? null : String(current));
              return data;
            })} disabled={isRunning('get_balance')}>
              {isRunning('get_balance') && <BusyIcon />}
              Check balance
            </Button>
            {balance !== null && <p className="text-lg font-semibold">৳ {balance}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Delivery status</CardTitle>
            <CardDescription>Look up a consignment by tracking code, invoice, or consignment ID.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[170px_1fr_auto]">
            <Select value={statusType} onValueChange={(value) => setStatusType(value as StatusIdentifier)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(identifierLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={statusValue} onChange={(event) => setStatusValue(event.target.value)} placeholder={`Enter ${identifierLabels[statusType].toLowerCase()}`} />
            <Button onClick={checkStatus} disabled={isRunning('status')}>
              {isRunning('status') && <BusyIcon />}
              Check
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5" />Return requests</CardTitle>
            <CardDescription>Create a return request, view one request, or retrieve all requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
              <Select value={returnIdentifierType} onValueChange={(value) => setReturnIdentifierType(value as StatusIdentifier)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(identifierLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={returnIdentifierValue} onChange={(event) => setReturnIdentifierValue(event.target.value)} placeholder={`Enter ${identifierLabels[returnIdentifierType].toLowerCase()}`} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="return-reason">Reason (optional)</Label>
              <Textarea id="return-reason" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="Why is this return requested?" />
            </div>
            <Button onClick={createReturnRequest} disabled={isRunning('create_return_request')}>
              {isRunning('create_return_request') && <BusyIcon />}
              Create return request
            </Button>
            <div className="border-t pt-4">
              <Label htmlFor="return-request-id">Return request ID</Label>
              <div className="mt-2 flex gap-2">
                <Input id="return-request-id" value={returnRequestId} onChange={(event) => setReturnRequestId(event.target.value)} placeholder="Enter return request ID" />
                <Button variant="outline" onClick={() => {
                  const id = returnRequestId.trim();
                  if (!id) return toast.error('Enter a return request ID');
                  void withResult('Return request', () => invokeManagement('get_return_request', { return_request_id: id }));
                }} disabled={isRunning('get_return_request')}>
                  {isRunning('get_return_request') && <BusyIcon />}
                  View
                </Button>
              </div>
              <Button className="mt-3" variant="secondary" onClick={() => withResult('Return requests', () => invokeManagement('get_return_requests'))} disabled={isRunning('get_return_requests')}>
                {isRunning('get_return_requests') && <BusyIcon />}
                {!isRunning('get_return_requests') && <Eye className='mr-2 h-4 w-4' />}
                View returns
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5" />Payments</CardTitle>
            <CardDescription>Retrieve recent payments or a payment with its consignments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => withResult('Payments', () => invokeManagement('get_payments'))} disabled={isRunning('get_payments')}>
              {isRunning('get_payments') && <BusyIcon />}
              Get payments
            </Button>
            <div className="border-t pt-4">
              <Label htmlFor="payment-id">Payment ID</Label>
              <div className="mt-2 flex gap-2">
                <Input id="payment-id" value={paymentId} onChange={(event) => setPaymentId(event.target.value)} placeholder="Enter payment ID" />
                <Button variant="outline" onClick={() => {
                  const id = paymentId.trim();
                  if (!id) return toast.error('Enter a payment ID');
                  void withResult('Payment consignments', () => invokeManagement('get_payment', { payment_id: id }));
                }} disabled={isRunning('get_payment')}>
                  {isRunning('get_payment') && <BusyIcon />}
                  View payment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPinned className="h-5 w-5" />Police stations</CardTitle>
          <CardDescription>Load the police-station directory supplied by Steadfast.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => withResult('Police stations', () => invokeManagement('get_police_stations'))} disabled={isRunning('get_police_stations')}>
            {isRunning('get_police_stations') && <BusyIcon />}
            Load police stations
          </Button>
        </CardContent>
      </Card>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />{lastResult.title}</CardTitle>
            <CardDescription>Response from Steadfast. Customer data is visible to administrators only.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[32rem] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed">{prettyJson(lastResult.value)}</pre>
          </CardContent>
        </Card>
      )}

      <Dialog open={returnsOpen} onOpenChange={setReturnsOpen}>
        <DialogContent className='max-h-[90vh] max-w-5xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Return requests</DialogTitle>
            <DialogDescription>
              {returnRequests.length === 1
                ? '1 return request found.'
                : returnRequests.length + ' return requests found.'}
            </DialogDescription>
          </DialogHeader>

          <div className='flex justify-end'>
            <Button
              variant='outline'
              size='sm'
              onClick={loadReturnRequests}
              disabled={isRunning('get_return_requests')}
            >
              {isRunning('get_return_requests') && <BusyIcon />}
              Refresh
            </Button>
          </div>

          {returnRequests.length > 0 ? (
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Consignment</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnRequests.map((request, index) => (
                    <TableRow key={textValue(request.id ?? String(index))}>
                      <TableCell className='font-medium'>{textValue(request.id)}</TableCell>
                      <TableCell>
                        {textValue(request.consignment_id ?? request.invoice ?? request.tracking_code)}
                      </TableCell>
                      <TableCell className='max-w-xs whitespace-normal'>{textValue(request.reason)}</TableCell>
                      <TableCell>
                        <Badge variant='outline' className='capitalize'>{textValue(request.status)}</Badge>
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>{formatDate(request.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : returnsResponse ? (
            <div className='space-y-3'>
              <p className='text-sm text-muted-foreground'>
                No return-request rows were found. The raw response is shown below.
              </p>
              <pre className='max-h-[24rem] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed'>
                {prettyJson(returnsResponse)}
              </pre>
            </div>
          ) : (
            <p className='py-8 text-center text-sm text-muted-foreground'>No return requests found.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
