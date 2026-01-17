import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Save, BarChart3, Eye, EyeOff, ShoppingCart, CreditCard, Facebook, 
  Ticket, Plus, Trash2, Pencil, Calendar, Percent, DollarSign, Mail, Bell, Music2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

type Coupon = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  usage_limit: number | null;
  used_count: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  created_at: string;
};

interface MailSettings {
  resend_api_key: string;
  notification_email: string;
  order_notification_enabled: boolean;
  contact_notification_enabled: boolean;
}

interface GoogleSettings {
  ga_measurement_id: string;
  gtm_id: string;
  ga_api_secret: string;
  ga_enabled: boolean;
  gtm_enabled: boolean;
  ga_server_enabled: boolean;
}

interface TikTokSettings {
  tiktok_pixel_id: string;
  tiktok_pixel_enabled: boolean;
  tiktok_access_token: string;
  tiktok_events_api_enabled: boolean;
  tiktok_test_event_code: string;
}

export default function AdminMarketing() {
  // Facebook state
  const [pixelId, setPixelId] = useState('');
  const [pixelEnabled, setPixelEnabled] = useState(false);
  const [capiToken, setCapiToken] = useState('');
  const [capiEnabled, setCapiEnabled] = useState(false);
  const [testEventCode, setTestEventCode] = useState('');
  const [savingFb, setSavingFb] = useState(false);
  const [loadingFb, setLoadingFb] = useState(true);
  const [showCapiToken, setShowCapiToken] = useState(false);

  // Google Analytics state
  const [googleSettings, setGoogleSettings] = useState<GoogleSettings>({
    ga_measurement_id: '',
    gtm_id: '',
    ga_api_secret: '',
    ga_enabled: false,
    gtm_enabled: false,
    ga_server_enabled: false,
  });
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [showGaSecret, setShowGaSecret] = useState(false);

  // TikTok state
  const [tiktokSettings, setTiktokSettings] = useState<TikTokSettings>({
    tiktok_pixel_id: '',
    tiktok_pixel_enabled: false,
    tiktok_access_token: '',
    tiktok_events_api_enabled: false,
    tiktok_test_event_code: '',
  });
  const [savingTiktok, setSavingTiktok] = useState(false);
  const [loadingTiktok, setLoadingTiktok] = useState(true);
  const [showTiktokToken, setShowTiktokToken] = useState(false);

  // Coupon state
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [savingCoupon, setSavingCoupon] = useState(false);

  // Email settings state
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(true);
  const [emailSettings, setEmailSettings] = useState<MailSettings>({
    resend_api_key: '',
    notification_email: '',
    order_notification_enabled: false,
    contact_notification_enabled: false,
  });

  // Coupon form state
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 0,
    min_order_amount: 0,
    max_discount_amount: 0,
    usage_limit: 0,
    starts_at: '',
    expires_at: '',
    is_active: true,
  });

  useEffect(() => {
    loadFacebookSettings();
    loadGoogleSettings();
    loadTikTokSettings();
    loadCoupons();
    loadEmailSettings();
  }, []);

  // TikTok functions
  const loadTikTokSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', [
          'tiktok_pixel_id',
          'tiktok_pixel_enabled',
          'tiktok_access_token',
          'tiktok_events_api_enabled',
          'tiktok_test_event_code',
        ]);

      if (error) throw error;

      const settings: TikTokSettings = {
        tiktok_pixel_id: '',
        tiktok_pixel_enabled: false,
        tiktok_access_token: '',
        tiktok_events_api_enabled: false,
        tiktok_test_event_code: '',
      };

      data?.forEach((setting) => {
        switch (setting.key) {
          case 'tiktok_pixel_id':
            settings.tiktok_pixel_id = setting.value;
            break;
          case 'tiktok_pixel_enabled':
            settings.tiktok_pixel_enabled = setting.value === 'true';
            break;
          case 'tiktok_access_token':
            settings.tiktok_access_token = setting.value;
            break;
          case 'tiktok_events_api_enabled':
            settings.tiktok_events_api_enabled = setting.value === 'true';
            break;
          case 'tiktok_test_event_code':
            settings.tiktok_test_event_code = setting.value;
            break;
        }
      });

      setTiktokSettings(settings);
    } catch (error) {
      console.error('Failed to load TikTok settings:', error);
      toast.error('Failed to load TikTok settings');
    } finally {
      setLoadingTiktok(false);
    }
  };

  const handleSaveTikTok = async () => {
    if (tiktokSettings.tiktok_pixel_enabled && !tiktokSettings.tiktok_pixel_id.trim()) {
      toast.error('Please enter a TikTok Pixel ID');
      return;
    }

    if (tiktokSettings.tiktok_events_api_enabled && !tiktokSettings.tiktok_access_token.trim()) {
      toast.error('Please enter a TikTok Events API Access Token');
      return;
    }

    setSavingTiktok(true);
    try {
      await Promise.all([
        upsertSetting('tiktok_pixel_id', tiktokSettings.tiktok_pixel_id.trim()),
        upsertSetting('tiktok_pixel_enabled', tiktokSettings.tiktok_pixel_enabled.toString()),
        upsertSetting('tiktok_access_token', tiktokSettings.tiktok_access_token.trim()),
        upsertSetting('tiktok_events_api_enabled', tiktokSettings.tiktok_events_api_enabled.toString()),
        upsertSetting('tiktok_test_event_code', tiktokSettings.tiktok_test_event_code.trim()),
      ]);

      toast.success('TikTok settings saved successfully');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save TikTok settings');
    } finally {
      setSavingTiktok(false);
    }
  };

  // Google Analytics functions
  const loadGoogleSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', [
          'ga_measurement_id',
          'gtm_id',
          'ga_api_secret',
          'ga_enabled',
          'gtm_enabled',
          'ga_server_enabled',
        ]);

      if (error) throw error;

      const settings: GoogleSettings = {
        ga_measurement_id: '',
        gtm_id: '',
        ga_api_secret: '',
        ga_enabled: false,
        gtm_enabled: false,
        ga_server_enabled: false,
      };

      data?.forEach((setting) => {
        switch (setting.key) {
          case 'ga_measurement_id':
            settings.ga_measurement_id = setting.value;
            break;
          case 'gtm_id':
            settings.gtm_id = setting.value;
            break;
          case 'ga_api_secret':
            settings.ga_api_secret = setting.value;
            break;
          case 'ga_enabled':
            settings.ga_enabled = setting.value === 'true';
            break;
          case 'gtm_enabled':
            settings.gtm_enabled = setting.value === 'true';
            break;
          case 'ga_server_enabled':
            settings.ga_server_enabled = setting.value === 'true';
            break;
        }
      });

      setGoogleSettings(settings);
    } catch (error) {
      console.error('Failed to load Google settings:', error);
      toast.error('Failed to load Google Analytics settings');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleSaveGoogle = async () => {
    if (googleSettings.ga_enabled && !googleSettings.ga_measurement_id.trim()) {
      toast.error('Please enter a GA4 Measurement ID');
      return;
    }

    if (googleSettings.gtm_enabled && !googleSettings.gtm_id.trim()) {
      toast.error('Please enter a GTM Container ID');
      return;
    }

    if (googleSettings.ga_server_enabled && (!googleSettings.ga_measurement_id.trim() || !googleSettings.ga_api_secret.trim())) {
      toast.error('Server-side tracking requires both Measurement ID and API Secret');
      return;
    }

    setSavingGoogle(true);
    try {
      await Promise.all([
        upsertSetting('ga_measurement_id', googleSettings.ga_measurement_id.trim()),
        upsertSetting('gtm_id', googleSettings.gtm_id.trim()),
        upsertSetting('ga_api_secret', googleSettings.ga_api_secret.trim()),
        upsertSetting('ga_enabled', googleSettings.ga_enabled.toString()),
        upsertSetting('gtm_enabled', googleSettings.gtm_enabled.toString()),
        upsertSetting('ga_server_enabled', googleSettings.ga_server_enabled.toString()),
      ]);

      toast.success('Google Analytics settings saved successfully');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save settings');
    } finally {
      setSavingGoogle(false);
    }
  };

  // Facebook functions
  const loadFacebookSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', [
          'fb_pixel_id',
          'fb_pixel_enabled',
          'fb_capi_token',
          'fb_capi_enabled',
          'fb_test_event_code',
        ]);

      if (error) throw error;

      data?.forEach((setting) => {
        switch (setting.key) {
          case 'fb_pixel_id':
            setPixelId(setting.value);
            break;
          case 'fb_pixel_enabled':
            setPixelEnabled(setting.value === 'true');
            break;
          case 'fb_capi_token':
            setCapiToken(setting.value);
            break;
          case 'fb_capi_enabled':
            setCapiEnabled(setting.value === 'true');
            break;
          case 'fb_test_event_code':
            setTestEventCode(setting.value);
            break;
        }
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load Facebook settings');
    } finally {
      setLoadingFb(false);
    }
  };

  const upsertSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from('admin_settings')
      .upsert({ key, value }, { onConflict: 'key' });

    if (error) throw error;
  };

  const handleSaveFacebook = async () => {
    if (pixelEnabled && !pixelId.trim()) {
      toast.error('Please enter a Facebook Pixel ID');
      return;
    }

    if (capiEnabled && !capiToken.trim()) {
      toast.error('Please enter a Conversion API Access Token');
      return;
    }

    setSavingFb(true);
    try {
      await Promise.all([
        upsertSetting('fb_pixel_id', pixelId.trim()),
        upsertSetting('fb_pixel_enabled', pixelEnabled.toString()),
        upsertSetting('fb_capi_token', capiToken.trim()),
        upsertSetting('fb_capi_enabled', capiEnabled.toString()),
        upsertSetting('fb_test_event_code', testEventCode.trim()),
      ]);

      toast.success('Facebook settings saved successfully');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save settings');
    } finally {
      setSavingFb(false);
    }
  };

  // Coupon functions
  const loadCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('Failed to load coupons:', error);
      toast.error('Failed to load coupons');
    } finally {
      setLoadingCoupons(false);
    }
  };

  const openCouponDialog = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setCouponForm({
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        min_order_amount: coupon.min_order_amount || 0,
        max_discount_amount: coupon.max_discount_amount || 0,
        usage_limit: coupon.usage_limit || 0,
        starts_at: coupon.starts_at ? coupon.starts_at.split('T')[0] : '',
        expires_at: coupon.expires_at ? coupon.expires_at.split('T')[0] : '',
        is_active: coupon.is_active ?? true,
      });
    } else {
      setEditingCoupon(null);
      setCouponForm({
        code: '',
        discount_type: 'percentage',
        discount_value: 0,
        min_order_amount: 0,
        max_discount_amount: 0,
        usage_limit: 0,
        starts_at: '',
        expires_at: '',
        is_active: true,
      });
    }
    setCouponDialogOpen(true);
  };

  const handleSaveCoupon = async () => {
    if (!couponForm.code.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    if (couponForm.discount_value <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }

    setSavingCoupon(true);
    try {
      const couponData = {
        code: couponForm.code.toUpperCase().trim(),
        discount_type: couponForm.discount_type,
        discount_value: couponForm.discount_value,
        min_order_amount: couponForm.min_order_amount || null,
        max_discount_amount: couponForm.max_discount_amount || null,
        usage_limit: couponForm.usage_limit || null,
        starts_at: couponForm.starts_at || null,
        expires_at: couponForm.expires_at || null,
        is_active: couponForm.is_active,
      };

      if (editingCoupon) {
        const { error } = await supabase
          .from('coupons')
          .update(couponData)
          .eq('id', editingCoupon.id);

        if (error) throw error;
        toast.success('Coupon updated successfully');
      } else {
        const { error } = await supabase
          .from('coupons')
          .insert(couponData);

        if (error) throw error;
        toast.success('Coupon created successfully');
      }

      setCouponDialogOpen(false);
      loadCoupons();
    } catch (error: any) {
      console.error('Save coupon error:', error);
      if (error.code === '23505') {
        toast.error('Coupon code already exists');
      } else {
        toast.error('Failed to save coupon');
      }
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;

    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Coupon deleted');
      loadCoupons();
    } catch (error) {
      console.error('Delete coupon error:', error);
      toast.error('Failed to delete coupon');
    }
  };

  const toggleCouponStatus = async (coupon: Coupon) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: !coupon.is_active })
        .eq('id', coupon.id);

      if (error) throw error;
      loadCoupons();
    } catch (error) {
      console.error('Toggle coupon error:', error);
      toast.error('Failed to update coupon status');
    }
  };

  // Email settings functions
  const loadEmailSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', [
          'resend_api_key',
          'notification_email',
          'order_notification_enabled',
          'contact_notification_enabled'
        ]);

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      data?.forEach(item => {
        settingsMap[item.key] = item.value;
      });

      setEmailSettings({
        resend_api_key: settingsMap.resend_api_key || '',
        notification_email: settingsMap.notification_email || '',
        order_notification_enabled: settingsMap.order_notification_enabled === 'true',
        contact_notification_enabled: settingsMap.contact_notification_enabled === 'true',
      });
    } catch (error) {
      console.error('Failed to load email settings:', error);
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleSaveEmail = async () => {
    if (emailSettings.order_notification_enabled || emailSettings.contact_notification_enabled) {
      if (!emailSettings.resend_api_key) {
        toast.error('Please enter Resend API key to enable notifications');
        return;
      }
      if (!emailSettings.notification_email) {
        toast.error('Please enter notification email address');
        return;
      }
    }

    setSavingEmail(true);
    try {
      const settingsToSave = [
        { key: 'resend_api_key', value: emailSettings.resend_api_key },
        { key: 'notification_email', value: emailSettings.notification_email },
        { key: 'order_notification_enabled', value: String(emailSettings.order_notification_enabled) },
        { key: 'contact_notification_enabled', value: String(emailSettings.contact_notification_enabled) },
      ];

      for (const setting of settingsToSave) {
        const { error } = await supabase
          .from('admin_settings')
          .upsert(
            { key: setting.key, value: setting.value, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          );
        if (error) throw error;
      }

      toast.success('Email settings saved successfully');
    } catch (error) {
      console.error('Save email error:', error);
      toast.error('Failed to save email settings');
    } finally {
      setSavingEmail(false);
    }
  };

  if (loadingFb && loadingGoogle && loadingTiktok && loadingCoupons && loadingEmail) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Marketing</h1>
        <p className="text-muted-foreground">Manage tracking, email notifications, and promotional coupons</p>
      </div>

      <Tabs defaultValue="facebook" className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="facebook" className="gap-2">
            <Facebook className="h-4 w-4" />
            Meta
          </TabsTrigger>
          <TabsTrigger value="tiktok" className="gap-2">
            <Music2 className="h-4 w-4" />
            TikTok
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Google
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="coupons" className="gap-2">
            <Ticket className="h-4 w-4" />
            Coupons
          </TabsTrigger>
        </TabsList>

        {/* Facebook Tab */}
        <TabsContent value="facebook" className="space-y-6">
          {/* Meta Pixel */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Meta Pixel (Facebook Pixel)
                  </CardTitle>
                  <CardDescription>
                    Track website visitors and their actions for Meta/Facebook Ads
                  </CardDescription>
                </div>
                <Switch
                  checked={pixelEnabled}
                  onCheckedChange={setPixelEnabled}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pixelId">Meta Pixel ID</Label>
                <Input
                  id="pixelId"
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                  placeholder="Enter your Meta Pixel ID (e.g., 123456789012345)"
                  disabled={!pixelEnabled}
                />
                <p className="text-xs text-muted-foreground">
                  Find your Pixel ID in Meta Events Manager → Data Sources → Your Pixel
                </p>
              </div>

              {pixelEnabled && pixelId && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    ✓ Pixel will track: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversion API */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                    Conversion API (CAPI)
                  </CardTitle>
                  <CardDescription>
                    Server-side tracking for better data accuracy and privacy compliance
                  </CardDescription>
                </div>
                <Switch
                  checked={capiEnabled}
                  onCheckedChange={setCapiEnabled}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="capiToken">Access Token</Label>
                <div className="relative">
                  <Input
                    id="capiToken"
                    type={showCapiToken ? "text" : "password"}
                    value={capiToken}
                    onChange={(e) => setCapiToken(e.target.value)}
                    placeholder="Enter your Conversion API Access Token"
                    disabled={!capiEnabled}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCapiToken(!showCapiToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground hover:text-primary transition-colors z-10"
                  >
                    {showCapiToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Generate a token in Events Manager → Settings → Conversions API
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="testEventCode">Test Event Code (Optional)</Label>
                <Input
                  id="testEventCode"
                  value={testEventCode}
                  onChange={(e) => setTestEventCode(e.target.value)}
                  placeholder="e.g., TEST12345"
                  disabled={!capiEnabled}
                />
                <p className="text-xs text-muted-foreground">
                  Use this to test events in Events Manager before going live
                </p>
              </div>

              {capiEnabled && capiToken && (
                <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                    ✓ Server-Side Tracking Active
                  </p>
                  <ul className="text-xs text-purple-700 dark:text-purple-300 space-y-1 list-disc list-inside">
                    <li>InitiateCheckout - When users start checkout</li>
                    <li>Purchase - Order completion with full customer data</li>
                    <li>Includes: Phone, Name, IP, User Agent, Meta ClickID (fbc), Browser ID (fbp)</li>
                  </ul>
                  <p className="text-xs text-purple-600 dark:text-purple-400 pt-2">
                    💡 Server-side events bypass ad blockers and improve match quality scores
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Events Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Tracked Events</CardTitle>
              <CardDescription>Events that will be sent to Facebook when enabled</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Eye className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">PageView</p>
                    <p className="text-xs text-muted-foreground">Every page visit</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Eye className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">ViewContent</p>
                    <p className="text-xs text-muted-foreground">Product detail views</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <ShoppingCart className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium text-sm">AddToCart</p>
                    <p className="text-xs text-muted-foreground">Items added to cart</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <CreditCard className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium text-sm">Purchase</p>
                    <p className="text-xs text-muted-foreground">Completed orders</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button onClick={handleSaveFacebook} disabled={savingFb} className="gap-2">
            <Save className="h-4 w-4" />
            {savingFb ? 'Saving...' : 'Save Facebook Settings'}
          </Button>
        </TabsContent>

        {/* TikTok Tab */}
        <TabsContent value="tiktok" className="space-y-6">
          {/* TikTok Pixel */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Music2 className="h-5 w-5 text-black dark:text-white" />
                    TikTok Pixel
                  </CardTitle>
                  <CardDescription>
                    Track website visitors and their actions for TikTok Ads
                  </CardDescription>
                </div>
                <Switch
                  checked={tiktokSettings.tiktok_pixel_enabled}
                  onCheckedChange={(checked) => setTiktokSettings({ ...tiktokSettings, tiktok_pixel_enabled: checked })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tiktokPixelId">TikTok Pixel ID</Label>
                <Input
                  id="tiktokPixelId"
                  value={tiktokSettings.tiktok_pixel_id}
                  onChange={(e) => setTiktokSettings({ ...tiktokSettings, tiktok_pixel_id: e.target.value })}
                  placeholder="Enter your TikTok Pixel ID"
                  disabled={!tiktokSettings.tiktok_pixel_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Find your Pixel ID in TikTok Ads Manager → Assets → Events → Web Events
                </p>
              </div>

              {tiktokSettings.tiktok_pixel_enabled && tiktokSettings.tiktok_pixel_id && (
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">
                    ✓ Pixel will track: PageView, ViewContent, AddToCart, InitiateCheckout, CompletePayment
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* TikTok Events API */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-cyan-600" />
                    TikTok Events API
                  </CardTitle>
                  <CardDescription>
                    Server-side tracking for better data accuracy and bypassing ad blockers
                  </CardDescription>
                </div>
                <Switch
                  checked={tiktokSettings.tiktok_events_api_enabled}
                  onCheckedChange={(checked) => setTiktokSettings({ ...tiktokSettings, tiktok_events_api_enabled: checked })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tiktokAccessToken">Access Token</Label>
                <div className="relative">
                  <Input
                    id="tiktokAccessToken"
                    type={showTiktokToken ? 'text' : 'password'}
                    value={tiktokSettings.tiktok_access_token}
                    onChange={(e) => setTiktokSettings({ ...tiktokSettings, tiktok_access_token: e.target.value })}
                    placeholder="Enter your TikTok Events API Access Token"
                    disabled={!tiktokSettings.tiktok_events_api_enabled}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTiktokToken(!showTiktokToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showTiktokToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Generate a token in TikTok for Business → Assets → Events → Settings → Events API
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tiktokTestEventCode">Test Event Code (Optional)</Label>
                <Input
                  id="tiktokTestEventCode"
                  value={tiktokSettings.tiktok_test_event_code}
                  onChange={(e) => setTiktokSettings({ ...tiktokSettings, tiktok_test_event_code: e.target.value })}
                  placeholder="e.g., TEST12345"
                  disabled={!tiktokSettings.tiktok_events_api_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Use this to test events before going live
                </p>
              </div>

              {tiktokSettings.tiktok_events_api_enabled && tiktokSettings.tiktok_access_token && (
                <div className="bg-cyan-50 dark:bg-cyan-950 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-cyan-800 dark:text-cyan-200">
                    ✓ Server-Side Tracking Active
                  </p>
                  <ul className="text-xs text-cyan-700 dark:text-cyan-300 space-y-1 list-disc list-inside">
                    <li>InitiateCheckout - When users start checkout</li>
                    <li>CompletePayment - Order completion with full customer data</li>
                    <li>Includes: Phone, Email, IP, User Agent, TikTok ClickID (ttclid)</li>
                  </ul>
                  <p className="text-xs text-cyan-600 dark:text-cyan-400 pt-2">
                    💡 Server-side events bypass ad blockers and improve match quality
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* TikTok Events Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Tracked Events</CardTitle>
              <CardDescription>Events that will be sent to TikTok when enabled</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Eye className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">PageView</p>
                    <p className="text-xs text-muted-foreground">Every page visit</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Eye className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">ViewContent</p>
                    <p className="text-xs text-muted-foreground">Product views</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <ShoppingCart className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium text-sm">AddToCart</p>
                    <p className="text-xs text-muted-foreground">Items added</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <CreditCard className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium text-sm">InitiateCheckout</p>
                    <p className="text-xs text-muted-foreground">Checkout starts</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="font-medium text-sm">CompletePayment</p>
                    <p className="text-xs text-muted-foreground">Purchases</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button onClick={handleSaveTikTok} disabled={savingTiktok} className="gap-2">
            <Save className="h-4 w-4" />
            {savingTiktok ? 'Saving...' : 'Save TikTok Settings'}
          </Button>
        </TabsContent>

        {/* Google Analytics Tab */}
        <TabsContent value="google" className="space-y-6">
          {/* Google Tag Manager */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-yellow-600" />
                    Google Tag Manager (GTM)
                  </CardTitle>
                  <CardDescription>
                    Use GTM to manage all your tracking tags in one place
                  </CardDescription>
                </div>
                <Switch
                  checked={googleSettings.gtm_enabled}
                  onCheckedChange={(checked) => setGoogleSettings({ ...googleSettings, gtm_enabled: checked })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gtmId">GTM Container ID</Label>
                <Input
                  id="gtmId"
                  value={googleSettings.gtm_id}
                  onChange={(e) => setGoogleSettings({ ...googleSettings, gtm_id: e.target.value })}
                  placeholder="GTM-XXXXXXX"
                  disabled={!googleSettings.gtm_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Find your Container ID in GTM → Admin → Container Settings
                </p>
              </div>

              {googleSettings.gtm_enabled && googleSettings.gtm_id && (
                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ✓ GTM will load on all pages. Configure your GA4, conversion tracking, and other tags in Google Tag Manager.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Google Analytics 4 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Google Analytics 4 (GA4)
                  </CardTitle>
                  <CardDescription>
                    Direct GA4 integration (use this if you're not using GTM)
                  </CardDescription>
                </div>
                <Switch
                  checked={googleSettings.ga_enabled}
                  onCheckedChange={(checked) => setGoogleSettings({ ...googleSettings, ga_enabled: checked })}
                  disabled={googleSettings.gtm_enabled}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gaMeasurementId">Measurement ID</Label>
                <Input
                  id="gaMeasurementId"
                  value={googleSettings.ga_measurement_id}
                  onChange={(e) => setGoogleSettings({ ...googleSettings, ga_measurement_id: e.target.value })}
                  placeholder="G-XXXXXXXXXX"
                  disabled={!googleSettings.ga_enabled && !googleSettings.ga_server_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Find this in GA4 → Admin → Data Streams → Your Stream
                </p>
              </div>

              {googleSettings.gtm_enabled && (
                <div className="bg-muted/50 border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    💡 GTM is enabled. Configure GA4 within your GTM container instead of here for better control.
                  </p>
                </div>
              )}

              {googleSettings.ga_enabled && googleSettings.ga_measurement_id && !googleSettings.gtm_enabled && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    ✓ GA4 will track: page_view, view_item, add_to_cart, begin_checkout, purchase
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Server-Side Tracking */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-green-600" />
                    Server-Side Tracking (Measurement Protocol)
                  </CardTitle>
                  <CardDescription>
                    Send events directly from server - bypasses ad blockers, no Stape.io needed
                  </CardDescription>
                </div>
                <Switch
                  checked={googleSettings.ga_server_enabled}
                  onCheckedChange={(checked) => setGoogleSettings({ ...googleSettings, ga_server_enabled: checked })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gaApiSecret">Measurement Protocol API Secret</Label>
                <div className="relative">
                  <Input
                    id="gaApiSecret"
                    type={showGaSecret ? 'text' : 'password'}
                    value={googleSettings.ga_api_secret}
                    onChange={(e) => setGoogleSettings({ ...googleSettings, ga_api_secret: e.target.value })}
                    placeholder="Enter your API Secret"
                    disabled={!googleSettings.ga_server_enabled}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowGaSecret(!showGaSecret)}
                  >
                    {showGaSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Create in GA4 → Admin → Data Streams → Your Stream → Measurement Protocol API secrets
                </p>
              </div>

              {googleSettings.ga_server_enabled && googleSettings.ga_api_secret && googleSettings.ga_measurement_id && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    ✓ Server-Side Tracking Active
                  </p>
                  <ul className="text-xs text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
                    <li>begin_checkout - When users start checkout</li>
                    <li>purchase - Order completion with transaction data</li>
                    <li>Events sent via Measurement Protocol API</li>
                  </ul>
                  <p className="text-xs text-green-600 dark:text-green-400 pt-2">
                    💡 Server-side events bypass ad blockers for accurate tracking
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Events Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Tracked Events</CardTitle>
              <CardDescription>E-commerce events that will be sent to Google Analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Eye className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">page_view</p>
                    <p className="text-xs text-muted-foreground">Every page visit</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Eye className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">view_item</p>
                    <p className="text-xs text-muted-foreground">Product views</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <ShoppingCart className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium text-sm">add_to_cart</p>
                    <p className="text-xs text-muted-foreground">Cart additions</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <CreditCard className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium text-sm">purchase</p>
                    <p className="text-xs text-muted-foreground">Completed orders</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button onClick={handleSaveGoogle} disabled={savingGoogle} className="gap-2">
            <Save className="h-4 w-4" />
            {savingGoogle ? 'Saving...' : 'Save Google Settings'}
          </Button>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Notifications
              </CardTitle>
              <CardDescription>
                Configure email notifications for your store. You need a Resend API key to send emails.
                Get one at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com</a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resend API Key */}
              <div className="space-y-2">
                <Label htmlFor="resend_api_key">Resend API Key</Label>
                <div className="relative">
                  <Input
                    id="resend_api_key"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="re_xxxxxxxxxx"
                    value={emailSettings.resend_api_key}
                    onChange={(e) => setEmailSettings({ ...emailSettings, resend_api_key: e.target.value })}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your API key is stored securely and used to send email notifications
                </p>
              </div>

              {/* Notification Email */}
              <div className="space-y-2">
                <Label htmlFor="notification_email">Notification Email</Label>
                <Input
                  id="notification_email"
                  type="email"
                  placeholder="admin@yourstore.com"
                  value={emailSettings.notification_email}
                  onChange={(e) => setEmailSettings({ ...emailSettings, notification_email: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Email address where you want to receive notifications
                </p>
              </div>

              <Separator />

              {/* Notification Toggles */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </h3>
                
                {/* Order Notifications */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Order Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email when a new order is placed with full order details
                    </p>
                  </div>
                  <Switch
                    checked={emailSettings.order_notification_enabled}
                    onCheckedChange={(checked) => 
                      setEmailSettings({ ...emailSettings, order_notification_enabled: checked })
                    }
                  />
                </div>

                {/* Contact Form Notifications */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Contact Form Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email when someone submits the contact form
                    </p>
                  </div>
                  <Switch
                    checked={emailSettings.contact_notification_enabled}
                    onCheckedChange={(checked) => 
                      setEmailSettings({ ...emailSettings, contact_notification_enabled: checked })
                    }
                  />
                </div>
              </div>

              <Button onClick={handleSaveEmail} disabled={savingEmail} className="gap-2">
                <Save className="h-4 w-4" />
                {savingEmail ? 'Saving...' : 'Save Email Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coupons Tab */}
        <TabsContent value="coupons" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-primary" />
                    Discount Coupons
                  </CardTitle>
                  <CardDescription>
                    Create and manage promotional discount codes
                  </CardDescription>
                </div>
                <Button onClick={() => openCouponDialog()} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Coupon
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCoupons ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : coupons.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No coupons created yet</p>
                  <p className="text-sm">Click "Add Coupon" to create your first discount code</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Min. Order</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Validity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coupons.map((coupon) => (
                        <TableRow key={coupon.id}>
                          <TableCell className="font-mono font-semibold">{coupon.code}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {coupon.discount_type === 'percentage' ? (
                                <>
                                  <Percent className="h-3 w-3" />
                                  {coupon.discount_value}%
                                </>
                              ) : (
                                <>
                                  <DollarSign className="h-3 w-3" />
                                  ৳{coupon.discount_value}
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {coupon.min_order_amount ? `৳${coupon.min_order_amount}` : '-'}
                          </TableCell>
                          <TableCell>
                            {coupon.usage_limit 
                              ? `${coupon.used_count || 0}/${coupon.usage_limit}`
                              : `${coupon.used_count || 0}/∞`
                            }
                          </TableCell>
                          <TableCell className="text-xs">
                            {coupon.expires_at ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(coupon.expires_at), 'dd MMM yyyy')}
                              </div>
                            ) : (
                              'No expiry'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={coupon.is_active ? 'default' : 'secondary'}
                              className="cursor-pointer"
                              onClick={() => toggleCouponStatus(coupon)}
                            >
                              {coupon.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openCouponDialog(coupon)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCoupon(coupon.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Coupon Dialog */}
      <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="couponCode">Coupon Code *</Label>
              <Input
                id="couponCode"
                value={couponForm.code}
                onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g., SAVE20"
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select
                  value={couponForm.discount_type}
                  onValueChange={(value) => setCouponForm({ ...couponForm, discount_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (৳)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountValue">Discount Value *</Label>
                <Input
                  id="discountValue"
                  type="number"
                  value={couponForm.discount_value || ''}
                  onChange={(e) => setCouponForm({ ...couponForm, discount_value: Number(e.target.value) })}
                  placeholder={couponForm.discount_type === 'percentage' ? '20' : '100'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minOrder">Min. Order Amount</Label>
                <Input
                  id="minOrder"
                  type="number"
                  value={couponForm.min_order_amount || ''}
                  onChange={(e) => setCouponForm({ ...couponForm, min_order_amount: Number(e.target.value) })}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxDiscount">Max Discount</Label>
                <Input
                  id="maxDiscount"
                  type="number"
                  value={couponForm.max_discount_amount || ''}
                  onChange={(e) => setCouponForm({ ...couponForm, max_discount_amount: Number(e.target.value) })}
                  placeholder="200"
                  disabled={couponForm.discount_type === 'fixed'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="usageLimit">Usage Limit (0 = unlimited)</Label>
              <Input
                id="usageLimit"
                type="number"
                value={couponForm.usage_limit || ''}
                onChange={(e) => setCouponForm({ ...couponForm, usage_limit: Number(e.target.value) })}
                placeholder="100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Start Date</Label>
                <Input
                  id="startsAt"
                  type="date"
                  value={couponForm.starts_at}
                  onChange={(e) => setCouponForm({ ...couponForm, starts_at: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expiry Date</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={couponForm.expires_at}
                  onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={couponForm.is_active}
                onCheckedChange={(checked) => setCouponForm({ ...couponForm, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCoupon} disabled={savingCoupon}>
              {savingCoupon ? 'Saving...' : editingCoupon ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
