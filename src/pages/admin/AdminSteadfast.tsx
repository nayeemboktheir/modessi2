import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Save, Eye, EyeOff, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function AdminSteadfast() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['steadfast_api_key', 'steadfast_secret_key']);

      if (error) throw error;

      data?.forEach((setting) => {
        if (setting.key === 'steadfast_api_key') {
          setApiKey(setting.value);
        } else if (setting.key === 'steadfast_secret_key') {
          setSecretKey(setting.value);
        }
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load Steadfast settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Upsert API key
      const { error: apiError } = await supabase
        .from('admin_settings')
        .upsert(
          { key: 'steadfast_api_key', value: apiKey, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (apiError) throw apiError;

      // Upsert Secret key
      const { error: secretError } = await supabase
        .from('admin_settings')
        .upsert(
          { key: 'steadfast_secret_key', value: secretKey, updated_at: new Date().toISOString() },
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
          Steadfast Courier
        </h1>
        <p className="text-muted-foreground">Manage your Steadfast courier API credentials</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Credentials</CardTitle>
          <CardDescription>
            Enter your Steadfast API credentials to enable automatic courier booking.
            You can get these from your Steadfast merchant portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Steadfast API Key"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secretKey">Secret Key</Label>
            <div className="relative">
              <Input
                id="secretKey"
                type={showSecretKey ? 'text' : 'password'}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Enter your Steadfast Secret Key"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowSecretKey(!showSecretKey)}
              >
                {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button onClick={saveSettings} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Credentials'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to Get Credentials</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Log in to your Steadfast merchant portal at <strong>portal.steadfast.com.bd</strong></p>
          <p>2. Navigate to Settings → API Settings</p>
          <p>3. Copy your API Key and Secret Key</p>
          <p>4. Paste them in the fields above and save</p>
        </CardContent>
      </Card>
    </div>
  );
}
