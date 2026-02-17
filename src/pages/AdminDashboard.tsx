import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Loader2, Plus, Trash2, Clock, UserPlus, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ManagedUser {
  user_id: string;
  display_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  expires_at: string | null;
  roles: string[];
  created_at: string;
}

const AdminDashboard = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { isAdmin, isRoleLoading } = useUserRole();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDays, setNewDays] = useState(30);
  const [newHours, setNewHours] = useState(0);

  // Extend form
  const [extDays, setExtDays] = useState(0);
  const [extHours, setExtHours] = useState(0);

  const isAr = lang === 'ar';

  const callAdmin = async (body: any) => {
    const { data, error } = await supabase.functions.invoke('admin-users', { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await callAdmin({ action: 'list-users' });
      setUsers(data.users || []);
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  if (isRoleLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isAdmin) {
    navigate('/');
    return null;
  }

  const handleCreate = async () => {
    if (!newEmail || !newPassword || !newName) return;
    setSubmitting(true);
    try {
      await callAdmin({
        action: 'create-user',
        email: newEmail,
        password: newPassword,
        displayName: newName,
        phone: newPhone,
        durationDays: newDays,
        durationHours: newHours,
      });
      toast({ title: isAr ? 'تم إنشاء الحساب بنجاح' : 'Account created successfully' });
      setCreateOpen(false);
      setNewName(''); setNewEmail(''); setNewPhone(''); setNewPassword(''); setNewDays(30); setNewHours(0);
      fetchUsers();
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      await callAdmin({ action: 'toggle-active', userId, isActive: !currentActive });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_active: !currentActive } : u));
      toast({ title: isAr ? 'تم تحديث الحالة' : 'Status updated' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  const handleExtend = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    try {
      const data = await callAdmin({ action: 'extend-duration', userId: selectedUserId, days: extDays, hours: extHours });
      setUsers(prev => prev.map(u => u.user_id === selectedUserId ? { ...u, expires_at: data.new_expires_at } : u));
      toast({ title: isAr ? 'تم تمديد المدة' : 'Duration extended' });
      setExtendOpen(false);
      setExtDays(0); setExtHours(0);
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذا الحساب؟' : 'Are you sure you want to delete this account?')) return;
    try {
      await callAdmin({ action: 'delete-user', userId });
      setUsers(prev => prev.filter(u => u.user_id !== userId));
      toast({ title: isAr ? 'تم حذف الحساب' : 'Account deleted' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return isAr ? 'غير محدد' : 'Not set';
    return new Date(d).toLocaleDateString(isAr ? 'ar-IQ' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isExpired = (d: string | null) => {
    if (!d) return false;
    return new Date(d) < new Date();
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {isAr ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
      </Button>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          {isAr ? 'إدارة المستخدمين' : 'User Management'}
        </h2>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1"><UserPlus className="h-4 w-4" /> {isAr ? 'إنشاء حساب' : 'Create Account'}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{isAr ? 'إنشاء حساب جديد' : 'Create New Account'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{isAr ? 'الاسم' : 'Name'}</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{isAr ? 'البريد الإلكتروني' : 'Email'}</Label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{isAr ? 'رقم الهاتف' : 'Phone'}</Label>
                <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{isAr ? 'كلمة المرور' : 'Password'}</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isAr ? 'المدة (أيام)' : 'Duration (days)'}</Label>
                  <Input type="number" min={0} value={newDays} onChange={e => setNewDays(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>{isAr ? 'المدة (ساعات)' : 'Duration (hours)'}</Label>
                  <Input type="number" min={0} value={newHours} onChange={e => setNewHours(parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={submitting || !newEmail || !newPassword || !newName} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'إنشاء' : 'Create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : users.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">{isAr ? 'لا يوجد مستخدمين' : 'No users found'}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isAr ? 'الاسم' : 'Name'}</TableHead>
                  <TableHead>{isAr ? 'البريد' : 'Email'}</TableHead>
                  <TableHead>{isAr ? 'الهاتف' : 'Phone'}</TableHead>
                  <TableHead>{isAr ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{isAr ? 'تاريخ الانتهاء' : 'Expires'}</TableHead>
                  <TableHead>{isAr ? 'الإجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.filter(u => !u.roles.includes('admin')).map(user => (
                  <TableRow key={user.user_id} className={!user.is_active || isExpired(user.expires_at) ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{user.display_name || '-'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.is_active}
                          onCheckedChange={() => handleToggleActive(user.user_id, user.is_active)}
                        />
                        <span className={`text-xs ${user.is_active ? 'text-green-600' : 'text-destructive'}`}>
                          {user.is_active ? (isAr ? 'فعال' : 'Active') : (isAr ? 'معطل' : 'Disabled')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={isExpired(user.expires_at) ? 'text-destructive font-medium' : ''}>
                        {formatDate(user.expires_at)}
                        {isExpired(user.expires_at) && (isAr ? ' (منتهي)' : ' (expired)')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            setSelectedUserId(user.user_id);
                            setExtDays(0);
                            setExtHours(0);
                            setExtendOpen(true);
                          }}
                        >
                          <Clock className="h-3 w-3" />
                          {isAr ? 'تمديد' : 'Extend'}
                        </Button>
                        <Button variant="destructive" size="sm" className="gap-1" onClick={() => handleDelete(user.user_id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Extend Duration Dialog */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isAr ? 'تمديد مدة الاستخدام' : 'Extend Usage Duration'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isAr ? 'أيام' : 'Days'}</Label>
                <Input type="number" min={0} value={extDays} onChange={e => setExtDays(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>{isAr ? 'ساعات' : 'Hours'}</Label>
                <Input type="number" min={0} value={extHours} onChange={e => setExtHours(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <Button onClick={handleExtend} disabled={submitting || (extDays === 0 && extHours === 0)} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'تمديد' : 'Extend')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
