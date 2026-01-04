import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, Eye, EyeOff, Truck, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function AdminCourierSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Steadfast
  const [showSteadfastApiKey, setShowSteadfastApiKey] = useState(false);
  const [showSteadfastSecretKey, setShowSteadfastSecretKey] = useState(false);
  const [steadfastApiKey, setSteadfastApiKey] = useState('');
  const [steadfastSecretKey, setSteadfastSecretKey] = useState('');
  
  // BD Courier
  const [showBdCourierApiKey, setShowBdCourierApiKey] = useState(false);
  const [bdCourierApiKey, setBdCourierApiKey] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['steadfast_api_key', 'steadfast_secret_key', 'bdcourier_api_key']);

      if (error) throw error;

      data?.forEach((setting) => {
        if (setting.key === 'steadfast_api_key') {
          setSteadfastApiKey(setting.value);
        } else if (setting.key === 'steadfast_secret_key') {
          setSteadfastSecretKey(setting.value);
        } else if (setting.key === 'bdcourier_api_key') {
          setBdCourierApiKey(setting.value);
        }
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load courier settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSteadfastSettings = async () => {
    setSaving(true);
    try {
      const { error: apiError } = await supabase
        .from('admin_settings')
        .upsert(
          { key: 'steadfast_api_key', value: steadfastApiKey, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (apiError) throw apiError;

      const { error: secretError } = await supabase
        .from('admin_settings')
        .upsert(
          { key: 'steadfast_secret_key', value: steadfastSecretKey, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (secretError) throw secretError;

      toast.success('Steadfast credentials saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save Steadfast settings');
    } finally {
      setSaving(false);
    }
  };

  const saveBdCourierSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert(
          { key: 'bdcourier_api_key', value: bdCourierApiKey, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) throw error;

      toast.success('BD Courier API key saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save BD Courier settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <Truck className="h-8 w-8" />
          Courier Settings
        </h1>
        <p className="text-muted-foreground">Manage your courier API credentials</p>
      </div>

      <Tabs defaultValue="steadfast" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="steadfast" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Steadfast
          </TabsTrigger>
          <TabsTrigger value="bdcourier" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            BD Courier
          </TabsTrigger>
        </TabsList>

        <TabsContent value="steadfast" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Steadfast API Credentials</CardTitle>
              <CardDescription>
                Enter your Steadfast API credentials to enable automatic courier booking.
                You can get these from your Steadfast merchant portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="steadfastApiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="steadfastApiKey"
                    type={showSteadfastApiKey ? 'text' : 'password'}
                    value={steadfastApiKey}
                    onChange={(e) => setSteadfastApiKey(e.target.value)}
                    placeholder="Enter your Steadfast API Key"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowSteadfastApiKey(!showSteadfastApiKey)}
                  >
                    {showSteadfastApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="steadfastSecretKey">Secret Key</Label>
                <div className="relative">
                  <Input
                    id="steadfastSecretKey"
                    type={showSteadfastSecretKey ? 'text' : 'password'}
                    value={steadfastSecretKey}
                    onChange={(e) => setSteadfastSecretKey(e.target.value)}
                    placeholder="Enter your Steadfast Secret Key"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowSteadfastSecretKey(!showSteadfastSecretKey)}
                  >
                    {showSteadfastSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button onClick={saveSteadfastSettings} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Steadfast Credentials'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How to Get Steadfast Credentials</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Log in to your Steadfast merchant portal at <strong>portal.steadfast.com.bd</strong></p>
              <p>2. Navigate to Settings → API Settings</p>
              <p>3. Copy your API Key and Secret Key</p>
              <p>4. Paste them in the fields above and save</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bdcourier" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>BD Courier API Credentials</CardTitle>
              <CardDescription>
                Enter your BD Courier API key to enable courier history lookup.
                This is used to check customer delivery history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bdCourierApiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="bdCourierApiKey"
                    type={showBdCourierApiKey ? 'text' : 'password'}
                    value={bdCourierApiKey}
                    onChange={(e) => setBdCourierApiKey(e.target.value)}
                    placeholder="Enter your BD Courier API Key"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowBdCourierApiKey(!showBdCourierApiKey)}
                  >
                    {showBdCourierApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button onClick={saveBdCourierSettings} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save BD Courier API Key'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How to Get BD Courier API Key</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Visit <strong>bdcourier.com</strong> and create an account</p>
              <p>2. Navigate to your account settings or API section</p>
              <p>3. Generate or copy your API key</p>
              <p>4. Paste it in the field above and save</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
