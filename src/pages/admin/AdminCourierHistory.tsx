import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Package, Truck, CheckCircle, XCircle, AlertTriangle, Loader2, Key, Eye, EyeOff, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CourierStats {
  name?: string;
  logo?: string;
  total_parcel?: number;
  success_parcel?: number;
  cancelled_parcel?: number;
  success_ratio?: number;
}

interface CourierData {
  status?: string;
  courierData?: {
    pathao?: CourierStats;
    steadfast?: CourierStats;
    redx?: CourierStats;
    paperfly?: CourierStats;
    parceldex?: CourierStats;
    summary?: {
      total_parcel?: number;
      success_parcel?: number;
      cancelled_parcel?: number;
      success_ratio?: number;
    };
  };
  reports?: unknown[];
}

export default function AdminCourierHistory() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CourierData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  
  // API Key settings
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [loadingApiKey, setLoadingApiKey] = useState(true);

  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'bdcourier_api_key')
        .single();

      if (!error && data) {
        setApiKey(data.value);
      }
    } catch (err) {
      console.error('Failed to load API key:', err);
    } finally {
      setLoadingApiKey(false);
    }
  };

  const handleSaveApiKey = async () => {
    setSavingApiKey(true);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key: 'bdcourier_api_key', value: apiKey, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      
      if (error) throw error;
      toast.success('API key saved successfully');
    } catch (err) {
      toast.error('Failed to save API key');
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleSearch = async () => {
    if (!phone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    
    try {
      const { data: response, error: fetchError } = await supabase.functions.invoke('courier-history', {
        body: { phone: phone.trim() }
      });

      console.log('Courier history response:', response);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (response?.error) {
        throw new Error(response.error);
      }

      // The response structure is { success: true, data: { status, courierData, reports } }
      setData(response?.data || {});
    } catch (err) {
      console.error('Failed to fetch courier history:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch courier history';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevel = (successRatio: number | undefined) => {
    if (successRatio === undefined) return { level: 'Unknown', color: 'secondary', icon: AlertTriangle };
    if (successRatio >= 80) return { level: 'Low Risk', color: 'default', icon: CheckCircle };
    if (successRatio >= 50) return { level: 'Medium Risk', color: 'secondary', icon: AlertTriangle };
    return { level: 'High Risk', color: 'destructive', icon: XCircle };
  };

  const CourierStatsCard = ({ name, stats }: { name: string; stats?: CourierStats }) => {
    if (!stats || stats.total_parcel === 0) return null;
    
    const successRate = stats.total_parcel ? Math.round((stats.success_parcel || 0) / stats.total_parcel * 100) : 0;
    
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            {name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{stats.total_parcel || 0}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{stats.success_parcel || 0}</div>
              <div className="text-xs text-muted-foreground">Delivered</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{stats.cancelled_parcel || 0}</div>
              <div className="text-xs text-muted-foreground">Cancelled</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{successRate}%</div>
              <div className="text-xs text-muted-foreground">Success</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const summary = data?.courierData?.summary;
  const courierData = data?.courierData;
  const risk = getRiskLevel(summary?.success_ratio);
  const RiskIcon = risk.icon;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Courier History</h1>
        <p className="text-muted-foreground">Check customer delivery history from all couriers</p>
      </div>

      {/* API Key & Search */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* API Key */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" />
              BD Courier API Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingApiKey ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter API key"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button onClick={handleSaveApiKey} disabled={savingApiKey} size="sm" className="w-full gap-2">
                  <Save className="h-3 w-3" />
                  {savingApiKey ? 'Saving...' : 'Save Key'}
                </Button>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Get your key from{' '}
              <a href="https://bdcourier.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                bdcourier.com
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Search */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Search Customer</CardTitle>
            <CardDescription>Check courier history from Pathao, RedX, Steadfast, and Paperfly</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="phone" className="sr-only">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="Enter phone number (e.g., 01712345678)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={loading || !apiKey} className="gap-2">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </Button>
            </div>
            {!apiKey && !loadingApiKey && (
              <p className="text-xs text-destructive mt-2">Please add your BD Courier API key first</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Card>
          <CardContent className="py-12 text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Failed to fetch history</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={handleSearch}>Try Again</Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {!loading && !error && searched && data && (
        <div className="space-y-6">
          {/* Overall Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Overall Summary</CardTitle>
                  <CardDescription>Combined statistics from all couriers</CardDescription>
                </div>
                <Badge variant={risk.color as any} className="gap-1 text-sm px-3 py-1">
                  <RiskIcon className="h-4 w-4" />
                  {risk.level}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold">{summary?.total_parcel || 0}</div>
                  <div className="text-sm text-muted-foreground">Total Parcels</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{summary?.success_parcel || 0}</div>
                  <div className="text-sm text-muted-foreground">Delivered</div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="text-3xl font-bold text-red-600">{summary?.cancelled_parcel || 0}</div>
                  <div className="text-sm text-muted-foreground">Cancelled</div>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg">
                  <div className="text-3xl font-bold text-primary">{summary?.success_ratio?.toFixed(1) || 0}%</div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Courier Breakdown */}
          <div>
            <h3 className="text-lg font-medium mb-4">Breakdown by Courier</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <CourierStatsCard name="Steadfast" stats={courierData?.steadfast} />
              <CourierStatsCard name="Pathao" stats={courierData?.pathao} />
              <CourierStatsCard name="RedX" stats={courierData?.redx} />
              <CourierStatsCard name="Paperfly" stats={courierData?.paperfly} />
            </div>
            {!courierData?.steadfast?.total_parcel && !courierData?.pathao?.total_parcel && !courierData?.redx?.total_parcel && !courierData?.paperfly?.total_parcel && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No courier history found for this phone number</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Initial State */}
      {!loading && !error && !searched && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Check Customer History</h3>
            <p className="text-muted-foreground">Enter a phone number above to search for delivery history</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
