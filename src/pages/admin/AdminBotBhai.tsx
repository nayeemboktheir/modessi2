import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Save, Bot } from 'lucide-react';

export default function AdminBotBhai() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

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
              <li>নতুন অর্ডার আসলে স্বয়ংক্রিয়ভাবে BotBhai-তে পাঠানো হবে।</li>
              <li>API Key ছাড়া কোনো সিঙ্ক হবে না।</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
