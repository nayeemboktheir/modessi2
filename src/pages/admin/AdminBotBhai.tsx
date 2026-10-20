import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Bot, Download, Package, RefreshCw, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type BotbhaiStatus = {
  configured: boolean;
  autoSync: boolean;
  pushedOrders: number;
  importedOrders: number;
  connection: { ok: boolean; remoteProducts?: number; error?: string; code?: string | null };
};

type SyncError = { productId: string; name: string; error: string };

// All BotBhai calls go through the botbhai-sync edge function; the API key never
// reaches the browser.
async function callSync<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('botbhai-sync', { body });
  if (error) {
    let message = error.message;
    try {
      const payload = await (error as { context?: Response }).context?.json();
      if (payload?.error) message = payload.code ? `${payload.error} (${payload.code})` : payload.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return data as T;
}

export default function AdminBotBhai() {
  const queryClient = useQueryClient();
  const [savingToggle, setSavingToggle] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ processed: number; total: number } | null>(null);
  const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);
  const [importing, setImporting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [lastImport, setLastImport] = useState<string | null>(null);
  const [lastPush, setLastPush] = useState<string | null>(null);

  const { data: status, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['botbhai-status'],
    queryFn: () => callSync<BotbhaiStatus>({ action: 'status' }),
  });

  const setAutoSync = async (enabled: boolean) => {
    setSavingToggle(true);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert(
          { key: 'botbhai_auto_sync', value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) throw error;
      toast.success(enabled ? 'Auto-sync enabled' : 'Auto-sync disabled');
      queryClient.invalidateQueries({ queryKey: ['botbhai-status'] });
    } catch (err) {
      toast.error(`Failed to save: ${(err as Error).message}`);
    } finally {
      setSavingToggle(false);
    }
  };

  const syncProducts = async () => {
    setSyncErrors([]);
    setSyncProgress({ processed: 0, total: 0 });
    let offset: number | null = 0;
    let synced = 0;
    let archived = 0;
    const errors: SyncError[] = [];

    try {
      while (offset !== null) {
        const page = await callSync<{
          synced: number;
          archived: number;
          errors: SyncError[];
          total: number;
          processed: number;
          nextOffset: number | null;
        }>({ action: 'sync_products', offset, limit: 10 });

        synced += page.synced;
        archived += page.archived;
        errors.push(...page.errors);
        setSyncErrors([...errors]);
        setSyncProgress({ processed: page.processed, total: page.total });
        offset = page.nextOffset;
      }

      if (errors.length > 0) {
        toast.warning(`Synced ${synced} products, archived ${archived}, ${errors.length} failed`);
      } else {
        toast.success(`Synced ${synced} products to BotBhai, archived ${archived} inactive`);
      }
      queryClient.invalidateQueries({ queryKey: ['botbhai-status'] });
    } catch (err) {
      toast.error(`Product sync stopped: ${(err as Error).message}`);
    } finally {
      setSyncProgress(null);
    }
  };

  const importOrders = async () => {
    setImporting(true);
    try {
      const result = await callSync<{
        imported: Array<{ botbhaiOrderNumber: string; orderNumber: string }>;
        errors: Array<{ botbhaiOrderNumber: string; error: string }>;
        remaining: number;
      }>({ action: 'import_orders', days: 3 });

      const parts = [`Imported ${result.imported.length} order(s)`];
      if (result.errors.length) parts.push(`${result.errors.length} failed`);
      if (result.remaining) parts.push(`${result.remaining} more waiting — run again`);
      setLastImport(
        [
          parts.join(', '),
          ...result.imported.map((o) => `BotBhai ${o.botbhaiOrderNumber} → #${o.orderNumber}`),
          ...result.errors.map((e) => `BotBhai ${e.botbhaiOrderNumber}: ${e.error}`),
        ].join('\n'),
      );
      (result.errors.length ? toast.warning : toast.success)(parts.join(', '));
      queryClient.invalidateQueries({ queryKey: ['botbhai-status'] });
    } catch (err) {
      toast.error(`Import failed: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  const pushRecentOrders = async () => {
    setPushing(true);
    try {
      const result = await callSync<{
        results: Array<{ orderNumber: string; status: string; detail?: string }>;
        remaining: number;
      }>({ action: 'push_recent_orders', days: 3 });

      const pushed = result.results.filter((r) => r.status === 'pushed').length;
      const failed = result.results.filter((r) => r.status === 'failed');
      const summary =
        `Pushed ${pushed} order(s)` +
        (failed.length ? `, ${failed.length} failed` : '') +
        (result.remaining ? `, ${result.remaining} more waiting — run again` : '');
      setLastPush(
        [summary, ...result.results.filter((r) => r.status !== 'pushed').map((r) => `#${r.orderNumber}: ${r.status} — ${r.detail}`)].join('\n'),
      );
      (failed.length ? toast.warning : toast.success)(summary);
      queryClient.invalidateQueries({ queryKey: ['botbhai-status'] });
    } catch (err) {
      toast.error(`Push failed: ${(err as Error).message}`);
    } finally {
      setPushing(false);
    }
  };

  const ready = !!status?.configured && !!status?.connection.ok;
  const syncing = syncProgress !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" /> BotBhai
          </h1>
          <p className="text-muted-foreground">
            Keep the BotBhai chatbot's catalogue and stock in step with the shop, and bring its orders in here.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          <CardDescription>
            The API key is read from the <code>BOTBHAI_API_KEY</code> environment variable on the edge-functions
            container. It needs the scopes products:read, products:write, orders:read and orders:write.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {!status?.configured ? (
                  <Badge variant="destructive">API key not set</Badge>
                ) : status.connection.ok ? (
                  <Badge className="bg-green-600 hover:bg-green-600">Connected</Badge>
                ) : (
                  <Badge variant="destructive">Error</Badge>
                )}
                {status?.connection.ok && (
                  <span className="text-sm text-muted-foreground">
                    {status.connection.remoteProducts} products on BotBhai · {status.pushedOrders} orders pushed ·{' '}
                    {status.importedOrders} orders imported
                  </span>
                )}
              </div>
              {status?.configured && !status.connection.ok && (
                <p className="text-sm text-destructive">
                  {status.connection.error}
                  {status.connection.code ? ` (${status.connection.code})` : ''}
                </p>
              )}

              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <Label htmlFor="botbhai-auto-sync">Auto-sync orders</Label>
                  <p className="text-sm text-muted-foreground">
                    Mirror every new website order to BotBhai with its stock as soon as it is placed, and import new
                    chatbot orders the moment BotBhai's webhook reports them. Status changes travel both ways for
                    orders already linked.
                  </p>
                </div>
                <Switch
                  id="botbhai-auto-sync"
                  checked={!!status?.autoSync}
                  disabled={savingToggle || !status?.configured}
                  onCheckedChange={setAutoSync}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Products and stock
          </CardTitle>
          <CardDescription>
            Push every product with its sizes, prices, images and current stock. Inactive products are archived on
            BotBhai. Run this after editing products or adjusting stock in Inventory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={syncProducts} disabled={!ready || syncing}>
            <Upload className="h-4 w-4 mr-2" />
            {syncing ? 'Syncing…' : 'Sync all products'}
          </Button>
          {syncProgress && syncProgress.total > 0 && (
            <div className="space-y-1">
              <Progress value={(syncProgress.processed / syncProgress.total) * 100} />
              <p className="text-sm text-muted-foreground">
                {syncProgress.processed} / {syncProgress.total}
              </p>
            </div>
          )}
          {syncErrors.length > 0 && (
            <div className="rounded-md border border-destructive/50 p-3 text-sm space-y-1">
              {syncErrors.map((e) => (
                <p key={e.productId}>
                  <span className="font-medium">{e.name}</span>: {e.error}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> Orders
          </CardTitle>
          <CardDescription>
            Chatbot orders appear in Orders with the source “BotBhai” and deduct stock like any other order. The import
            button pulls in pending and confirmed ones from the last 3 days; orders already imported, or pushed from
            here, are skipped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={importOrders} disabled={!ready || importing}>
              <Download className="h-4 w-4 mr-2" />
              {importing ? 'Importing…' : 'Import BotBhai orders'}
            </Button>
            <Button variant="outline" onClick={pushRecentOrders} disabled={!ready || pushing}>
              <Upload className="h-4 w-4 mr-2" />
              {pushing ? 'Pushing…' : 'Push missed website orders'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            With auto-sync on these buttons are a catch-up for anything missed — for example orders placed while the
            webhook was off. Webhook URL for BotBhai → Integrations → REST API → Webhooks:{' '}
            <code className="break-all">{`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/botbhai-webhook`}</code>
          </p>
          {lastImport && <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{lastImport}</pre>}
          {lastPush && <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{lastPush}</pre>}
        </CardContent>
      </Card>
    </div>
  );
}
