import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Save, 
  Shield, 
  Clock, 
  History, 
  UserX, 
  Percent, 
  AlertTriangle,
  Phone,
  ShieldCheck,
  Settings
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface OrderProtectionSettings {
  // Input-Based Blocking
  input_blocking_enabled: boolean;
  max_phone_changes: number;
  otp_abuse_threshold: number;
  
  // Time-Based Blocking
  time_blocking_enabled: boolean;
  order_cooldown_hours: number;
  
  // History-Based Blocking
  history_blocking_enabled: boolean;
  min_success_rate: number;
  
  // New Customer OTP
  new_customer_otp_enabled: boolean;
  
  // Custom History Blocking
  custom_history_blocking_enabled: boolean;
  return_rate_otp_threshold: number;
  return_rate_block_threshold: number;
  
  // Status-Based Blocking
  status_blocking_enabled: boolean;
  block_pending_orders: boolean;
  block_shipped_orders: boolean;
  block_returned_orders: boolean;
  max_pending_orders: number;
}

const defaultSettings: OrderProtectionSettings = {
  input_blocking_enabled: false,
  max_phone_changes: 3,
  otp_abuse_threshold: 5,
  time_blocking_enabled: false,
  order_cooldown_hours: 12,
  history_blocking_enabled: false,
  min_success_rate: 50,
  new_customer_otp_enabled: false,
  custom_history_blocking_enabled: false,
  return_rate_otp_threshold: 20,
  return_rate_block_threshold: 50,
  status_blocking_enabled: false,
  block_pending_orders: true,
  block_shipped_orders: false,
  block_returned_orders: true,
  max_pending_orders: 2,
};

const AdminOrderProtection = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<OrderProtectionSettings>(defaultSettings);

  // Fetch existing settings
  const { data: existingSettings, isLoading } = useQuery({
    queryKey: ['order-protection-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .like('key', 'order_protection_%');
      
      if (error) throw error;
      
      const settingsMap: Record<string, string> = {};
      data?.forEach(item => {
        settingsMap[item.key.replace('order_protection_', '')] = item.value;
      });
      
      return settingsMap;
    },
  });

  // Update settings state when data is loaded
  useEffect(() => {
    if (existingSettings) {
      setSettings({
        input_blocking_enabled: existingSettings.input_blocking_enabled === 'true',
        max_phone_changes: parseInt(existingSettings.max_phone_changes) || 3,
        otp_abuse_threshold: parseInt(existingSettings.otp_abuse_threshold) || 5,
        time_blocking_enabled: existingSettings.time_blocking_enabled === 'true',
        order_cooldown_hours: parseInt(existingSettings.order_cooldown_hours) || 12,
        history_blocking_enabled: existingSettings.history_blocking_enabled === 'true',
        min_success_rate: parseInt(existingSettings.min_success_rate) || 50,
        new_customer_otp_enabled: existingSettings.new_customer_otp_enabled === 'true',
        custom_history_blocking_enabled: existingSettings.custom_history_blocking_enabled === 'true',
        return_rate_otp_threshold: parseInt(existingSettings.return_rate_otp_threshold) || 20,
        return_rate_block_threshold: parseInt(existingSettings.return_rate_block_threshold) || 50,
        status_blocking_enabled: existingSettings.status_blocking_enabled === 'true',
        block_pending_orders: existingSettings.block_pending_orders !== 'false',
        block_shipped_orders: existingSettings.block_shipped_orders === 'true',
        block_returned_orders: existingSettings.block_returned_orders !== 'false',
        max_pending_orders: parseInt(existingSettings.max_pending_orders) || 2,
      });
    }
  }, [existingSettings]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: OrderProtectionSettings) => {
      const settingsToSave = Object.entries(newSettings).map(([key, value]) => ({
        key: `order_protection_${key}`,
        value: String(value),
      }));

      for (const setting of settingsToSave) {
        const { error } = await supabase
          .from('admin_settings')
          .upsert(
            { key: setting.key, value: setting.value, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          );
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-protection-settings'] });
      toast.success('Order protection settings saved successfully');
    },
    onError: (error) => {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Order Protection Settings
          </h1>
          <p className="text-muted-foreground">
            Configure fraud prevention and order blocking rules
          </p>
        </div>

        {/* Overview Card */}
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5" />
              6 Types of Order Blocking
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              Enable the blocking methods that suit your business needs
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 1. Input-Based Blocking */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-blue-500" />
                  Input-Based Blocking
                </CardTitle>
                <Switch
                  checked={settings.input_blocking_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, input_blocking_enabled: checked })
                  }
                />
              </div>
              <CardDescription>
                Block based on phone number changes and OTP abuse
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Max Phone Number Changes</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.max_phone_changes}
                  onChange={(e) => setSettings({ ...settings, max_phone_changes: parseInt(e.target.value) || 3 })}
                  disabled={!settings.input_blocking_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Block if customer changes phone more than this
                </p>
              </div>
              <div className="space-y-2">
                <Label>OTP Abuse Threshold</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.otp_abuse_threshold}
                  onChange={(e) => setSettings({ ...settings, otp_abuse_threshold: parseInt(e.target.value) || 5 })}
                  disabled={!settings.input_blocking_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Block after this many OTP requests
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 2. Time-Based Blocking */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-green-500" />
                  Time-Based Blocking
                </CardTitle>
                <Switch
                  checked={settings.time_blocking_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, time_blocking_enabled: checked })
                  }
                />
              </div>
              <CardDescription>
                Prevent orders within a cooldown period
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Order Cooldown (Hours)</Label>
                <Input
                  type="number"
                  min="1"
                  max="72"
                  value={settings.order_cooldown_hours}
                  onChange={(e) => setSettings({ ...settings, order_cooldown_hours: parseInt(e.target.value) || 12 })}
                  disabled={!settings.time_blocking_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum hours between orders from same phone
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3. History-Based Blocking */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-red-500" />
                  History-Based Blocking
                </CardTitle>
                <Switch
                  checked={settings.history_blocking_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, history_blocking_enabled: checked })
                  }
                />
              </div>
              <CardDescription>
                Block if courier return rate is too high
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Minimum Success Rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.min_success_rate}
                  onChange={(e) => setSettings({ ...settings, min_success_rate: parseInt(e.target.value) || 50 })}
                  disabled={!settings.history_blocking_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Block if delivery success rate is below this (Returned &gt; Received)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 4. New Customer OTP */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5 text-purple-500" />
                  New Customer OTP
                </CardTitle>
                <Switch
                  checked={settings.new_customer_otp_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, new_customer_otp_enabled: checked })
                  }
                />
              </div>
              <CardDescription>
                Require OTP verification for customers with no history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                When enabled, new customers (Received: 0 | Returned: 0) will need to verify via OTP before placing an order.
              </div>
            </CardContent>
          </Card>

          {/* 5. Custom History Blocking */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5 text-orange-500" />
                  Custom History Blocking
                </CardTitle>
                <Switch
                  checked={settings.custom_history_blocking_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, custom_history_blocking_enabled: checked })
                  }
                />
              </div>
              <CardDescription>
                OTP or block based on return percentage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>OTP Required Threshold (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.return_rate_otp_threshold}
                  onChange={(e) => setSettings({ ...settings, return_rate_otp_threshold: parseInt(e.target.value) || 20 })}
                  disabled={!settings.custom_history_blocking_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Require OTP if return rate is above this (e.g., 20%)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Block Threshold (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.return_rate_block_threshold}
                  onChange={(e) => setSettings({ ...settings, return_rate_block_threshold: parseInt(e.target.value) || 50 })}
                  disabled={!settings.custom_history_blocking_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Completely block if return rate exceeds this (e.g., 50%)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 6. Status-Based Blocking */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-cyan-500" />
                  Status-Based Blocking
                </CardTitle>
                <Switch
                  checked={settings.status_blocking_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, status_blocking_enabled: checked })
                  }
                />
              </div>
              <CardDescription>
                Block based on existing order statuses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-normal">Block if has Pending orders</Label>
                  <Switch
                    checked={settings.block_pending_orders}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, block_pending_orders: checked })
                    }
                    disabled={!settings.status_blocking_enabled}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="font-normal">Block if has Shipped orders</Label>
                  <Switch
                    checked={settings.block_shipped_orders}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, block_shipped_orders: checked })
                    }
                    disabled={!settings.status_blocking_enabled}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="font-normal">Block if has Returned orders</Label>
                  <Switch
                    checked={settings.block_returned_orders}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, block_returned_orders: checked })
                    }
                    disabled={!settings.status_blocking_enabled}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Max Pending Orders Allowed</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.max_pending_orders}
                  onChange={(e) => setSettings({ ...settings, max_pending_orders: parseInt(e.target.value) || 2 })}
                  disabled={!settings.status_blocking_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Block if customer has more pending orders than this
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saveMutation.isPending}
            size="lg"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save All Settings'}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOrderProtection;
