import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Search, Users, Shield, User, Plus, Loader2, KeyRound } from 'lucide-react';
import { getAllUsers, updateUserRole } from '@/services/adminService';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  user_roles: { user_id: string; role: 'admin' | 'user' }[];
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Add admin dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '', fullName: '' });
  
  // Reset password dialog state
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetUserName, setResetUserName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await getAllUsers();
      setUsers(data || []);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const getUserRole = (user: UserProfile): 'admin' | 'user' => {
    return user.user_roles?.[0]?.role || 'user';
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || getUserRole(user) === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    setUpdating(userId);
    try {
      await updateUserRole(userId, newRole);
      toast.success('User role updated');
      loadUsers();
    } catch (error) {
      toast.error('Failed to update user role');
    } finally {
      setUpdating(null);
    }
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.[0]?.toUpperCase() || 'U';
  };

  const handleCreateAdmin = async () => {
    if (!newAdmin.email || !newAdmin.password) {
      toast.error('Email and password are required');
      return;
    }
    
    if (newAdmin.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email: newAdmin.email,
          password: newAdmin.password,
          fullName: newAdmin.fullName,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Admin user created successfully');
      setNewAdmin({ email: '', password: '', fullName: '' });
      setIsAddDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create admin user');
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !newPassword) {
      toast.error('Password is required');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId: resetUserId,
          newPassword: newPassword,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Password reset successfully');
      setNewPassword('');
      setResetUserId(null);
      setIsResetDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  const openResetDialog = (userId: string, userName: string) => {
    setResetUserId(userId);
    setResetUserName(userName);
    setNewPassword('');
    setIsResetDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Card>
          <CardContent className="p-0">
            <div className="space-y-4 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Users</h1>
          <p className="text-muted-foreground">Manage user accounts and roles</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Admin User</DialogTitle>
              <DialogDescription>
                Create a new admin account with email and password
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Enter full name"
                  value={newAdmin.fullName}
                  onChange={(e) => setNewAdmin(prev => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAdmin} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Admin'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => getUserRole(u) === 'admin').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Regular Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => getUserRole(u) === 'user').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="user">Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.full_name || 'Unnamed'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell className="text-muted-foreground">{user.phone || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(user.created_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={getUserRole(user)}
                      onValueChange={(value: 'admin' | 'user') => handleRoleChange(user.user_id, value)}
                      disabled={updating === user.user_id}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            User
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-3 w-3" />
                            Admin
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openResetDialog(user.user_id, user.full_name || user.email || 'User')}
                      className="gap-1"
                    >
                      <KeyRound className="h-4 w-4" />
                      Reset Password
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reset Password Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetUserName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Min 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={isResetting}>
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
