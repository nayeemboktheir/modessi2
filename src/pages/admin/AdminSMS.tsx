import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Settings, History, Send, RefreshCw, Save, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";

interface SmsTemplate {
  id: string;
  template_key: string;
  template_name: string;
  message_template: string;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface SmsLog {
  id: string;
  phone_number: string;
  message: string;
  template_key: string | null;
  order_id: string | null;
  status: string;
  provider_response: any;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface SmsSettings {
  sms_provider: string;
  sms_api_key: string;
  sms_sender_id: string;
  sms_enabled: string;
  sms_auto_send_order_placed: string;
  sms_auto_send_status_change: string;
}

const SMS_PROVIDERS = [
  { value: 'bulksmsbd', label: 'BulkSMSBD', description: 'Popular Bangladesh SMS provider' },
  { value: 'sslwireless', label: 'SSL Wireless', description: 'SSL Wireless SMS Gateway' },
  { value: 'infobip', label: 'Infobip', description: 'International SMS provider' },
  { value: 'twilio', label: 'Twilio', description: 'Global cloud communications' },
];

const TEMPLATE_VARIABLES = [
  { key: 'customer_name', description: 'Customer full name' },
  { key: 'order_number', description: 'Order number (e.g., ORD-20241223-0001)' },
  { key: 'total', description: 'Order total amount' },
  { key: 'tracking_number', description: 'Shipping tracking number' },
  { key: 'phone', description: 'Customer phone number' },
];

export default function AdminSMS() {
  const [activeTab, setActiveTab] = useState("settings");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState<SmsSettings>({
    sms_provider: 'bulksmsbd',
    sms_api_key: '',
    sms_sender_id: '',
    sms_enabled: 'false',
    sms_auto_send_order_placed: 'true',
    sms_auto_send_status_change: 'true',
  });
  
  // Templates state
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  
  // Logs state
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Test SMS state
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    loadSettings();
    loadTemplates();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', [
          'sms_provider',
          'sms_api_key',
          'sms_sender_id',
          'sms_enabled',
          'sms_auto_send_order_placed',
          'sms_auto_send_status_change',
        ]);

      if (error) throw error;

      const newSettings: any = { ...settings };
      data?.forEach((item) => {
        newSettings[item.key] = item.value;
      });
      setSettings(newSettings);
    } catch (error) {
      console.error('Error loading SMS settings:', error);
      toast.error('Failed to load SMS settings');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_templates')
        .select('*')
        .order('template_key');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load SMS templates');
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Failed to load SMS logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from('admin_settings')
          .upsert({ key, value }, { onConflict: 'key' });

        if (error) throw error;
      }
      toast.success('SMS settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = async (id: string, message: string) => {
    try {
      const { error } = await supabase
        .from('sms_templates')
        .update({ message_template: message })
        .eq('id', id);

      if (error) throw error;
      
      setTemplates(templates.map(t => 
        t.id === id ? { ...t, message_template: message } : t
      ));
      setEditingTemplate(null);
      toast.success('Template updated successfully');
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    }
  };

  const toggleTemplateActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('sms_templates')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      
      setTemplates(templates.map(t => 
        t.id === id ? { ...t, is_active: isActive } : t
      ));
      toast.success(`Template ${isActive ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling template:', error);
      toast.error('Failed to update template');
    }
  };

  const sendTestSms = async () => {
    if (!testPhone || !testMessage) {
      toast.error('Please enter phone number and message');
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          phone: testPhone,
          message: testMessage,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Test SMS sent successfully!');
        setTestPhone('');
        setTestMessage('');
        loadLogs();
      } else {
        toast.error(data.message || 'Failed to send SMS');
      }
    } catch (error: any) {
      console.error('Error sending test SMS:', error);
      toast.error(error.message || 'Failed to send test SMS');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">SMS Management</h1>
          <p className="text-muted-foreground">
            Configure SMS notifications for your customers
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="test" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Test SMS
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2" onClick={loadLogs}>
              <History className="h-4 w-4" />
              SMS Logs
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>SMS Provider Settings</CardTitle>
                <CardDescription>
                  Configure your SMS gateway provider and credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Turn on to send SMS notifications to customers
                    </p>
                  </div>
                  <Switch
                    checked={settings.sms_enabled === 'true'}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, sms_enabled: checked ? 'true' : 'false' })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>SMS Provider</Label>
                  <Select
                    value={settings.sms_provider}
                    onValueChange={(value) => setSettings({ ...settings, sms_provider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {SMS_PROVIDERS.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          <div className="flex flex-col">
                            <span>{provider.label}</span>
                            <span className="text-xs text-muted-foreground">{provider.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    placeholder="Enter your SMS provider API key"
                    value={settings.sms_api_key}
                    onChange={(e) => setSettings({ ...settings, sms_api_key: e.target.value })}
                  />
                  {settings.sms_provider === 'twilio' && (
                    <p className="text-xs text-muted-foreground">
                      For Twilio, enter in format: accountSid:authToken
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Sender ID</Label>
                  <Input
                    placeholder="e.g., MyShop or +8801XXXXXXXXX"
                    value={settings.sms_sender_id}
                    onChange={(e) => setSettings({ ...settings, sms_sender_id: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    The sender name or number shown to recipients
                  </p>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-semibold">Auto-Send Options</h3>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Send on Order Placed</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically send SMS when a new order is placed
                      </p>
                    </div>
                    <Switch
                      checked={settings.sms_auto_send_order_placed === 'true'}
                      onCheckedChange={(checked) => 
                        setSettings({ ...settings, sms_auto_send_order_placed: checked ? 'true' : 'false' })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Send on Status Change</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically send SMS when order status changes
                      </p>
                    </div>
                    <Switch
                      checked={settings.sms_auto_send_status_change === 'true'}
                      onCheckedChange={(checked) => 
                        setSettings({ ...settings, sms_auto_send_status_change: checked ? 'true' : 'false' })
                      }
                    />
                  </div>
                </div>

                <Button onClick={saveSettings} disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Message Templates</CardTitle>
                <CardDescription>
                  Customize SMS messages for different order events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Available Variables</h4>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <Badge key={v.key} variant="secondary" className="font-mono">
                        {`{{${v.key}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {templates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{template.template_name}</h4>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={template.is_active}
                            onCheckedChange={(checked) => toggleTemplateActive(template.id, checked)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {template.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>

                      {editingTemplate === template.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editedMessage}
                            onChange={(e) => setEditedMessage(e.target.value)}
                            rows={3}
                            className="font-mono text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => updateTemplate(template.id, editedMessage)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTemplate(null)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm bg-muted p-3 rounded flex-1 font-mono">
                            {template.message_template}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingTemplate(template.id);
                              setEditedMessage(template.message_template);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Test SMS Tab */}
          <TabsContent value="test" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Send Test SMS</CardTitle>
                <CardDescription>
                  Test your SMS configuration by sending a test message
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    placeholder="01XXXXXXXXX"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    placeholder="Enter test message..."
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    rows={4}
                  />
                </div>

                <Button 
                  onClick={sendTestSms} 
                  disabled={sendingTest || !testPhone || !testMessage}
                  className="w-full"
                >
                  {sendingTest ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Test SMS
                    </>
                  )}
                </Button>

                {settings.sms_enabled !== 'true' && (
                  <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded">
                    ⚠️ SMS is currently disabled. Enable it in Settings to send messages.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>SMS Logs</CardTitle>
                  <CardDescription>
                    View history of all sent SMS messages
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={loadLogs} disabled={logsLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${logsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No SMS logs found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                          </TableCell>
                          <TableCell className="font-mono">{log.phone_number}</TableCell>
                          <TableCell className="max-w-xs truncate" title={log.message}>
                            {log.message}
                          </TableCell>
                          <TableCell>
                            {log.template_key ? (
                              <Badge variant="outline">{log.template_key}</Badge>
                            ) : (
                              <span className="text-muted-foreground">Custom</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={log.status === 'sent' ? 'default' : 'destructive'}
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
