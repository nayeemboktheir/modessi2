import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Mail, Phone, User, MessageSquare, Check, Trash2, Eye, Settings, Save } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ContactSubmission {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

const AdminContactSubmissions = () => {
  const queryClient = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Fetch contact submissions
  const { data: submissions, isLoading } = useQuery({
    queryKey: ['contact-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ContactSubmission[];
    },
  });

  // Fetch notification email setting
  const { data: emailSetting } = useQuery({
    queryKey: ['contact-notification-email'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'contact_notification_email')
        .maybeSingle();

      if (error) throw error;
      if (data) setNotificationEmail(data.value);
      return data?.value || '';
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contact_submissions')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-submissions'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contact_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-submissions'] });
      toast.success('মেসেজ মুছে ফেলা হয়েছে');
    },
    onError: () => {
      toast.error('মেসেজ মুছতে সমস্যা হয়েছে');
    },
  });

  // Save email setting mutation
  const saveEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data: existing } = await supabase
        .from('admin_settings')
        .select('id')
        .eq('key', 'contact_notification_email')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('admin_settings')
          .update({ value: email })
          .eq('key', 'contact_notification_email');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('admin_settings')
          .insert({ key: 'contact_notification_email', value: email });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-notification-email'] });
      toast.success('ইমেইল সেটিং সেভ হয়েছে');
      setIsSettingsOpen(false);
    },
    onError: () => {
      toast.error('সেটিং সেভ করতে সমস্যা হয়েছে');
    },
  });

  const handleViewSubmission = (submission: ContactSubmission) => {
    setSelectedSubmission(submission);
    if (!submission.is_read) {
      markAsReadMutation.mutate(submission.id);
    }
  };

  const unreadCount = submissions?.filter(s => !s.is_read).length || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">যোগাযোগ মেসেজ</h1>
            <p className="text-muted-foreground">
              কাস্টমারদের পাঠানো মেসেজ দেখুন
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} নতুন
                </Badge>
              )}
            </p>
          </div>
          <Button variant="outline" onClick={() => setIsSettingsOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            ইমেইল সেটিং
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : submissions?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">কোনো মেসেজ নেই</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {submissions?.map((submission) => (
              <Card
                key={submission.id}
                className={`cursor-pointer transition-colors hover:border-primary/50 ${
                  !submission.is_read ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => handleViewSubmission(submission)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">{submission.name}</span>
                        {!submission.is_read && (
                          <Badge variant="default" className="text-xs">নতুন</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-2">
                        {submission.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {submission.email}
                          </div>
                        )}
                        {submission.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {submission.phone}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {submission.message}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(submission.created_at), 'dd/MM/yyyy hh:mm a')}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewSubmission(submission);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>মেসেজ মুছে ফেলুন?</AlertDialogTitle>
                              <AlertDialogDescription>
                                এই মেসেজটি স্থায়ীভাবে মুছে যাবে।
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>বাতিল</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(submission.id)}
                              >
                                মুছুন
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* View Submission Dialog */}
        <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>মেসেজ বিস্তারিত</DialogTitle>
            </DialogHeader>
            {selectedSubmission && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">নাম</p>
                    <p className="font-medium">{selectedSubmission.name}</p>
                  </div>
                </div>
                {selectedSubmission.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">ইমেইল</p>
                      <p className="font-medium">{selectedSubmission.email}</p>
                    </div>
                  </div>
                )}
                {selectedSubmission.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">ফোন</p>
                      <p className="font-medium">{selectedSubmission.phone}</p>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">মেসেজ</p>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="whitespace-pre-wrap">{selectedSubmission.message}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  পাঠানো হয়েছে: {format(new Date(selectedSubmission.created_at), 'dd MMMM yyyy, hh:mm a')}
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Email Settings Dialog */}
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>নোটিফিকেশন ইমেইল সেটিং</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="notification-email">ইমেইল ঠিকানা</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  যোগাযোগ ফর্ম পূরণ করলে এই ইমেইলে নোটিফিকেশন পাবেন
                </p>
                <Input
                  id="notification-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                />
              </div>
              <Button
                onClick={() => saveEmailMutation.mutate(notificationEmail)}
                disabled={saveEmailMutation.isPending}
                className="w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                সেভ করুন
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminContactSubmissions;
