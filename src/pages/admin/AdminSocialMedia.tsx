import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageCircle, Phone, Save } from "lucide-react";

interface SocialMediaSettings {
  messenger_enabled: boolean;
  messenger_page_id: string;
  whatsapp_enabled: boolean;
  whatsapp_number: string;
  call_enabled: boolean;
  call_number: string;
}

const defaultSettings: SocialMediaSettings = {
  messenger_enabled: false,
  messenger_page_id: "",
  whatsapp_enabled: false,
  whatsapp_number: "",
  call_enabled: false,
  call_number: "",
};

const AdminSocialMedia = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SocialMediaSettings>(defaultSettings);

  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["social-media-settings"],
    queryFn: async () => {
      const keys = ["messenger_enabled", "messenger_page_id", "whatsapp_enabled", "whatsapp_number", "call_enabled", "call_number"];
      const { data, error } = await supabase
        .from("admin_settings")
        .select("key, value")
        .in("key", keys);

      if (error) throw error;

      const result: SocialMediaSettings = { ...defaultSettings };
      data?.forEach((item) => {
        if (item.key === "messenger_enabled") result.messenger_enabled = item.value === "true";
        if (item.key === "messenger_page_id") result.messenger_page_id = item.value;
        if (item.key === "whatsapp_enabled") result.whatsapp_enabled = item.value === "true";
        if (item.key === "whatsapp_number") result.whatsapp_number = item.value;
        if (item.key === "call_enabled") result.call_enabled = item.value === "true";
        if (item.key === "call_number") result.call_number = item.value;
      });
      return result;
    },
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings(savedSettings);
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: SocialMediaSettings) => {
      const updates = [
        { key: "messenger_enabled", value: String(newSettings.messenger_enabled) },
        { key: "messenger_page_id", value: newSettings.messenger_page_id },
        { key: "whatsapp_enabled", value: String(newSettings.whatsapp_enabled) },
        { key: "whatsapp_number", value: newSettings.whatsapp_number },
        { key: "call_enabled", value: String(newSettings.call_enabled) },
        { key: "call_number", value: newSettings.call_number },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from("admin_settings")
          .upsert(
            { key: update.key, value: update.value, updated_at: new Date().toISOString() },
            { onConflict: "key" }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-media-settings"] });
      toast.success("Social media settings saved!");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to save settings");
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Media</h1>
          <p className="text-muted-foreground">
            Configure chat buttons for Messenger and WhatsApp
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Messenger Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Facebook Messenger</CardTitle>
                <CardDescription>
                  Allow customers to message you on Messenger
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="messenger-enabled">Enable Messenger Button</Label>
              <Switch
                id="messenger-enabled"
                checked={settings.messenger_enabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, messenger_enabled: checked }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="messenger-page-id">Messenger Link</Label>
              <Input
                id="messenger-page-id"
                value={settings.messenger_page_id}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, messenger_page_id: e.target.value }))
                }
                placeholder="e.g., https://www.facebook.com/messages/t/KhejurerBajar1"
              />
              <p className="text-xs text-muted-foreground">
                Enter your full Messenger link (e.g., https://www.facebook.com/messages/t/YourPageName or https://m.me/YourPageName)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Phone className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle>WhatsApp</CardTitle>
                <CardDescription>
                  Allow customers to message you on WhatsApp
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="whatsapp-enabled">Enable WhatsApp Button</Label>
              <Switch
                id="whatsapp-enabled"
                checked={settings.whatsapp_enabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, whatsapp_enabled: checked }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-number">WhatsApp Number</Label>
              <Input
                id="whatsapp-number"
                value={settings.whatsapp_number}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, whatsapp_number: e.target.value }))
                }
                placeholder="e.g., 8801XXXXXXXXX"
              />
              <p className="text-xs text-muted-foreground">
                Enter your WhatsApp number with country code (no + or spaces)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Call Now Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Phone className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <CardTitle>Call Now (Product Page)</CardTitle>
                <CardDescription>
                  Show a call button on product pages
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="call-enabled">Enable Call Button</Label>
              <Switch
                id="call-enabled"
                checked={settings.call_enabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, call_enabled: checked }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="call-number">Phone Number</Label>
              <Input
                id="call-number"
                value={settings.call_number}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, call_number: e.target.value }))
                }
                placeholder="e.g., 01820-808514"
              />
              <p className="text-xs text-muted-foreground">
                This number will be shown on product pages for "Call Now" button
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            This is how the chat buttons will appear on your website
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative h-32 bg-muted rounded-lg flex items-end justify-end p-4">
            <div className="flex flex-col gap-3">
              {settings.whatsapp_enabled && settings.whatsapp_number && (
                <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
              )}
              {settings.messenger_enabled && settings.messenger_page_id && (
                <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform">
                  <MessageCircle className="w-7 h-7 text-white" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSocialMedia;
