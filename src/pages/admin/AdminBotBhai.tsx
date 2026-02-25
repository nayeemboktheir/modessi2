import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Save, Bot, RefreshCw, Loader2, Package, ShoppingCart } from 'lucide-react';
import { syncAllProductsToBotBhai, syncAllOrdersToBotBhai } from '@/services/botbhaiService';

export default function AdminBotBhai() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [syncingOrders, setSyncingOrders] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['botbhai-api-key'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'botbhai_api_key')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data?.value) setApiKey(data.value);
      return data?.value || '';
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      const { data: existing } = await supabase
        .from('admin_settings')
        .select('id')
        .eq('key', 'botbhai_api_key')
        .single();

      if (existing) {
        const { error } = await supabase
          .from('admin_settings')
          .update({ value: key, updated_at: new Date().toISOString() })
          .eq('key', 'botbhai_api_key');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('admin_settings')
          .insert({ key: 'botbhai_api_key', value: key });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botbhai-api-key'] });
      toast({ title: 'সেভ হয়েছে', description: 'BotBhai API Key সফলভাবে সেভ হয়েছে।' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'API Key সেভ করতে সমস্যা হয়েছে।', variant: 'destructive' });
    },
  });

  const handleSyncProducts = async () => {
    setSyncingProducts(true);
    try {
      const result = await syncAllProductsToBotBhai((synced, total) => {
        toast({
          title: 'প্রোডাক্ট সিঙ্ক হচ্ছে...',
          description: `Synced ${synced}/${total} products...`,
        });
      });
      toast({
        title: 'প্রোডাক্ট সিঙ্ক সফল!',
        description: result.message,
      });
    } catch (err) {
      toast({
        title: 'সিঙ্ক ব্যর্থ',
        description: 'প্রোডাক্ট সিঙ্ক করতে সমস্যা হয়েছে।',
        variant: 'destructive',
      });
    } finally {
      setSyncingProducts(false);
    }
  };

  const handleSyncOrders = async () => {
    setSyncingOrders(true);
    try {
      const result = await syncAllOrdersToBotBhai();
      toast({
        title: 'অর্ডার সিঙ্ক সফল!',
        description: result?.message || 'All orders synced successfully!',
      });
    } catch (err) {
      toast({
        title: 'সিঙ্ক ব্যর্থ',
        description: 'অর্ডার সিঙ্ক করতে সমস্যা হয়েছে।',
        variant: 'destructive',
      });
    } finally {
      setSyncingOrders(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">BotBhai Integration</h1>
        <p className="text-muted-foreground">BotBhai CRM এর সাথে প্রোডাক্ট ও অর্ডার সিঙ্ক করুন।</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            API Key Settings
          </CardTitle>
          <CardDescription>
            আপনার BotBhai API Key এখানে সেভ করুন। এটি প্রোডাক্ট ও অর্ডার সিঙ্ক করতে ব্যবহৃত হবে।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botbhai-key">BotBhai API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="botbhai-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your BotBhai API Key"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                onClick={() => saveMutation.mutate(apiKey)}
                disabled={saveMutation.isPending || !apiKey.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">কিভাবে কাজ করে:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>প্রোডাক্ট তৈরি, আপডেট বা ডিলিট করলে স্বয়ংক্রিয়ভাবে BotBhai-তে সিঙ্ক হবে।</li>
              <li>নতুন অর্ডার আসলে বা স্ট্যাটাস পরিবর্তন হলে BotBhai-তে পাঠানো হবে।</li>
              <li>API Key ছাড়া কোনো সিঙ্ক হবে না।</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Manual Sync
          </CardTitle>
          <CardDescription>
            প্রোডাক্ট ও অর্ডার আলাদাভাবে BotBhai-তে সিঙ্ক করুন। প্রোডাক্ট সিঙ্ক ব্যাচে হবে (৫টি করে, ১৫ সেকেন্ড বিরতি)।
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={handleSyncProducts}
            disabled={syncingProducts || syncingOrders || !apiKey.trim()}
            size="lg"
          >
            {syncingProducts ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing Products...
              </>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Sync All Products
              </>
            )}
          </Button>

          <Button
            onClick={handleSyncOrders}
            disabled={syncingProducts || syncingOrders || !apiKey.trim()}
            size="lg"
            variant="outline"
          >
            {syncingOrders ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing Orders...
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Sync All Orders
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
