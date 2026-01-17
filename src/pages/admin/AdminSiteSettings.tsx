import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Settings, Globe, Upload, Image } from 'lucide-react';

interface HeaderSettings {
  site_name: string;
  site_logo: string;
  header_phone: string;
  header_promo_text: string;
}

const AdminSiteSettings = () => {
  const queryClient = useQueryClient();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [headerSettings, setHeaderSettings] = useState<HeaderSettings>({
    site_name: 'খেজুর বাজার',
    site_logo: '',
    header_phone: '+880 1234-567890',
    header_promo_text: 'Free shipping on orders over ৳2000',
  });

  // Fetch existing settings
  const { data: existingSettings, isLoading } = useQuery({
    queryKey: ['admin-site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', [
          'site_name',
          'site_logo',
          'header_phone',
          'header_promo_text'
        ]);
      
      if (error) throw error;
      
      const settingsMap: Record<string, string> = {};
      data?.forEach(item => {
        settingsMap[item.key] = item.value;
      });
      
      return settingsMap;
    },
  });

  // Update settings state when data is loaded
  // Important: don't overwrite local edits due to automatic refetches
  useEffect(() => {
    if (existingSettings && !isEditing) {
      setHeaderSettings({
        site_name: existingSettings.site_name || 'খেজুর বাজার',
        site_logo: existingSettings.site_logo || '',
        header_phone: existingSettings.header_phone || '+880 1234-567890',
        header_promo_text: existingSettings.header_promo_text || 'Free shipping on orders over ৳2000',
      });
    }
  }, [existingSettings, isEditing]);

  // Save header settings mutation
  const saveHeaderMutation = useMutation({
    mutationFn: async (newSettings: HeaderSettings) => {
      const settingsToSave = [
        { key: 'site_name', value: newSettings.site_name },
        { key: 'site_logo', value: newSettings.site_logo },
        { key: 'header_phone', value: newSettings.header_phone },
        { key: 'header_promo_text', value: newSettings.header_promo_text },
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
    },
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] });
      queryClient.invalidateQueries({ queryKey: ['header-settings'] });
      toast.success('Header settings saved successfully');
    },
    onError: (error) => {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    },
  });

  const handleSaveHeaderSettings = () => {
    saveHeaderMutation.mutate(headerSettings);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setIsEditing(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('shop-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(filePath);

      const nextSettings = { ...headerSettings, site_logo: publicUrl };
      setHeaderSettings(nextSettings);

      // Auto-save right after upload so the storefront header updates immediately
      saveHeaderMutation.mutate(nextSettings);

      toast.success('Logo uploaded & saved successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
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
            <Settings className="h-8 w-8" />
            Site Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your site configuration
          </p>
        </div>

        {/* Header Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Header Settings
            </CardTitle>
            <CardDescription>
              Configure your site header including logo, site name, phone number, and promotional text
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Site Logo */}
            <div className="space-y-2">
              <Label>Site Logo</Label>
              <div className="flex items-center gap-4">
                {headerSettings.site_logo ? (
                  <img 
                    src={headerSettings.site_logo} 
                    alt="Site Logo" 
                    className="h-16 w-auto object-contain border rounded p-2"
                  />
                ) : (
                  <div className="h-16 w-16 border rounded flex items-center justify-center bg-muted">
                    <Image className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button type="button" variant="outline" disabled={uploadingLogo} asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      </span>
                    </Button>
                  </label>
                  <Input
                    placeholder="Or paste image URL"
                    value={headerSettings.site_logo}
                    onChange={(e) => {
                      setIsEditing(true);
                      setHeaderSettings((prev) => ({ ...prev, site_logo: e.target.value }));
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Site Name */}
            <div className="space-y-2">
              <Label htmlFor="site_name">Site Name</Label>
              <Input
                id="site_name"
                placeholder="Your Store Name"
                value={headerSettings.site_name}
                onChange={(e) => {
                  setIsEditing(true);
                  setHeaderSettings((prev) => ({ ...prev, site_name: e.target.value }));
                }}
              />
              <p className="text-xs text-muted-foreground">
                The name displayed in the header next to your logo
              </p>
            </div>

            {/* Header Phone */}
            <div className="space-y-2">
              <Label htmlFor="header_phone">Phone Number</Label>
              <Input
                id="header_phone"
                placeholder="+880 1234-567890"
                value={headerSettings.header_phone}
                onChange={(e) => {
                  setIsEditing(true);
                  setHeaderSettings((prev) => ({ ...prev, header_phone: e.target.value }));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Phone number displayed in the top bar
              </p>
            </div>

            {/* Promo Text */}
            <div className="space-y-2">
              <Label htmlFor="header_promo_text">Promotional Text</Label>
              <Input
                id="header_promo_text"
                placeholder="Free shipping on orders over ৳2000"
                value={headerSettings.header_promo_text}
                onChange={(e) => {
                  setIsEditing(true);
                  setHeaderSettings((prev) => ({ ...prev, header_promo_text: e.target.value }));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Promotional message shown in the header bar
              </p>
            </div>

            <div className="pt-4">
              <Button 
                onClick={handleSaveHeaderSettings} 
                disabled={saveHeaderMutation.isPending}
                className="w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveHeaderMutation.isPending ? 'Saving...' : 'Save Header Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSiteSettings;
