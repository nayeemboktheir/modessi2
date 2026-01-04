import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Trash2, Save, Store, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function AdminShopSettings() {
  const [shopName, setShopName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['shop_name', 'shop_logo_url', 'favicon_url']);

      if (error) throw error;

      data?.forEach((setting) => {
        if (setting.key === 'shop_name') setShopName(setting.value);
        if (setting.key === 'shop_logo_url') setLogoUrl(setting.value);
        if (setting.key === 'favicon_url') setFaviconUrl(setting.value);
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `shop-logo.${fileExt}`;

      // Delete existing logo if any
      await supabase.storage.from('shop-assets').remove([fileName]);

      const { error: uploadError } = await supabase.storage
        .from('shop-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(fileName);

      const newLogoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setLogoUrl(newLogoUrl);

      // Save to admin_settings
      await upsertSetting('shop_logo_url', newLogoUrl);
      
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 500 * 1024) {
      toast.error('Favicon must be less than 500KB');
      return;
    }

    setUploadingFavicon(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `favicon.${fileExt}`;

      // Delete existing favicon if any
      await supabase.storage.from('shop-assets').remove([fileName]);

      const { error: uploadError } = await supabase.storage
        .from('shop-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(fileName);

      const newFaviconUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setFaviconUrl(newFaviconUrl);

      // Save to admin_settings
      await upsertSetting('favicon_url', newFaviconUrl);

      // Update the favicon in the document
      updateDocumentFavicon(newFaviconUrl);
      
      toast.success('Favicon uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload favicon');
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleDeleteLogo = async () => {
    try {
      await supabase.storage.from('shop-assets').remove(['shop-logo.png', 'shop-logo.jpg', 'shop-logo.jpeg', 'shop-logo.webp']);
      
      await supabase.from('admin_settings').delete().eq('key', 'shop_logo_url');
      
      setLogoUrl(null);
      toast.success('Logo deleted');
    } catch (error) {
      toast.error('Failed to delete logo');
    }
  };

  const handleDeleteFavicon = async () => {
    try {
      await supabase.storage.from('shop-assets').remove(['favicon.png', 'favicon.jpg', 'favicon.ico', 'favicon.webp']);
      
      await supabase.from('admin_settings').delete().eq('key', 'favicon_url');
      
      setFaviconUrl(null);
      
      // Reset to default favicon
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = '/favicon.ico';
      }
      
      toast.success('Favicon deleted');
    } catch (error) {
      toast.error('Failed to delete favicon');
    }
  };

  const updateDocumentFavicon = (url: string) => {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
  };

  const upsertSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from('admin_settings')
      .upsert({ key, value }, { onConflict: 'key' });
    
    if (error) throw error;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertSetting('shop_name', shopName);
      await upsertSetting('site_name', shopName);
      // Update document title immediately
      document.title = shopName;
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Shop Settings</h1>
        <p className="text-muted-foreground">Configure your shop name, logo, and favicon for invoices</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Shop Name */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Shop Name
            </CardTitle>
            <CardDescription>
              This name will appear on all invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shopName">Shop Name</Label>
              <Input
                id="shopName"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Enter your shop name"
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Shop Name'}
            </Button>
          </CardContent>
        </Card>

        {/* Shop Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Shop Logo
            </CardTitle>
            <CardDescription>
              Upload your logo (max 2MB, PNG/JPG/WebP)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {logoUrl ? (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-muted/50">
                  <img
                    src={logoUrl}
                    alt="Shop Logo"
                    className="max-h-24 object-contain mx-auto"
                  />
                </div>
                <div className="flex gap-2">
                  <Label
                    htmlFor="logo-replace"
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors">
                      <Upload className="h-4 w-4" />
                      Replace Logo
                    </div>
                    <input
                      id="logo-replace"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                    />
                  </Label>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={handleDeleteLogo}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {uploading ? 'Uploading...' : 'Click to upload logo'}
                  </p>
                </div>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                />
              </Label>
            )}
          </CardContent>
        </Card>

        {/* Favicon */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Favicon
            </CardTitle>
            <CardDescription>
              Browser tab icon (max 500KB, PNG/ICO preferred)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {faviconUrl ? (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-muted/50">
                  <img
                    src={faviconUrl}
                    alt="Favicon"
                    className="w-16 h-16 object-contain mx-auto"
                  />
                </div>
                <div className="flex gap-2">
                  <Label
                    htmlFor="favicon-replace"
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors">
                      <Upload className="h-4 w-4" />
                      Replace Favicon
                    </div>
                    <input
                      id="favicon-replace"
                      type="file"
                      accept="image/*,.ico"
                      className="hidden"
                      onChange={handleFaviconUpload}
                      disabled={uploadingFavicon}
                    />
                  </Label>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={handleDeleteFavicon}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Label htmlFor="favicon-upload" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                  <Image className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {uploadingFavicon ? 'Uploading...' : 'Click to upload favicon'}
                  </p>
                </div>
                <input
                  id="favicon-upload"
                  type="file"
                  accept="image/*,.ico"
                  className="hidden"
                  onChange={handleFaviconUpload}
                  disabled={uploadingFavicon}
                />
              </Label>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Preview</CardTitle>
          <CardDescription>
            This is how your logo and shop name will appear on invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-6 bg-white text-black max-w-md">
            <div className="flex items-start justify-between">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-12 object-contain" />
              ) : (
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>
                  {shopName || 'Your Shop'}
                </h2>
              )}
              <div className="text-right">
                <span className="text-lg font-bold">INVOICE</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
