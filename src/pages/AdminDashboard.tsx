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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, UserPlus, Shield, Clock, Trash2, Pencil, Phone, Send, Instagram, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const FEATURES = [
  { key: 'research', ar: 'البحوث الأكاديمية', en: 'Academic Research', cost: 2 },
  { key: 'thesis', ar: 'رسائل الدراسات العليا', en: 'Graduate Theses', cost: 5 },
  { key: 'reports', ar: 'التقارير', en: 'Reports', cost: 1 },
  { key: 'cv', ar: 'السيرة الذاتية', en: 'CV Builder', cost: 0.5 },
  { key: 'proofreading', ar: 'التدقيق والكشف الأكاديمي', en: 'Academic Proofreading & Plagiarism', cost: 0.5 },
  { key: 'exam_expert', ar: 'خبير الامتحانات', en: 'Exam Expert', cost: 0.01 },
  { key: 'translator', ar: 'الترجمة', en: 'Translation', cost: 0 },
  { key: 'summarizer', ar: 'التلخيص', en: 'Summarizer', cost: 0.25 },
];

interface ManagedUser {
  user_id: string;
  display_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  expires_at: string | null;
  account_type: string;
  roles: string[];
  created_at: string;
  feature_access: Record<string, boolean>;
  feature_points: Record<string, { points: number; expires_at: string | null }>;
}

const AdminDashboard = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { isAdmin, isRoleLoading } = useUserRole();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDays, setNewDays] = useState(30);
  const [newHours, setNewHours] = useState(0);
  const [newAccountType, setNewAccountType] = useState('unlimited');
  const [newFeatureAccess, setNewFeatureAccess] = useState<Record<string, boolean>>(
    Object.fromEntries(FEATURES.map(f => [f.key, true]))
  );
  const [newFeaturePoints, setNewFeaturePoints] = useState<Record<string, number>>(
    Object.fromEntries(FEATURES.map(f => [f.key, 0]))
  );
  const [newPointsExpiry, setNewPointsExpiry] = useState('');

  // Extend form
  const [extDays, setExtDays] = useState(0);
  const [extHours, setExtHours] = useState(0);

  // Edit form
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAccountType, setEditAccountType] = useState('unlimited');
  const [editFeatureAccess, setEditFeatureAccess] = useState<Record<string, boolean>>({});
  const [editFeaturePoints, setEditFeaturePoints] = useState<Record<string, number>>({});
  const [editPointsExpiry, setEditPointsExpiry] = useState('');

  // Contact settings
  const [contactPhone, setContactPhone] = useState('');
  const [contactTelegram, setContactTelegram] = useState('');
  const [contactInstagram, setContactInstagram] = useState('');
  const [savingContact, setSavingContact] = useState(false);

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

  const fetchContactSettings = async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value')
        .abortSignal(controller.signal);
      clearTimeout(timer);
      if (error || !data) return;
      data.forEach((s: any) => {
        if (s.key === 'contact_phone') setContactPhone(s.value);
        if (s.key === 'contact_telegram') setContactTelegram(s.value);
        if (s.key === 'contact_instagram') setContactInstagram(s.value);
      });
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchContactSettings();
    }
  }, [isAdmin]);

  if (isRoleLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isAdmin) { navigate('/'); return null; }

  const handleSaveContact = async () => {
    setSavingContact(true);
    try {
      await callAdmin({
        action: 'update-settings',
        settings: [
          { key: 'contact_phone', value: contactPhone },
          { key: 'contact_telegram', value: contactTelegram },
          { key: 'contact_instagram', value: contactInstagram },
        ]
      });
      toast({ title: isAr ? 'تم حفظ معلومات التواصل' : 'Contact info saved' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSavingContact(false);
    }
  };

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
        accountType: newAccountType,
        featureAccess: newFeatureAccess,
        featurePoints: newAccountType === 'points' ? newFeaturePoints : null,
        pointsExpiresAt: newAccountType === 'points' && newPointsExpiry ? newPointsExpiry : null,
      });
      toast({ title: isAr ? 'تم إنشاء الحساب بنجاح' : 'Account created successfully' });
      setCreateOpen(false);
      resetCreateForm();
      fetchUsers();
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setNewName(''); setNewEmail(''); setNewPhone(''); setNewPassword('');
    setNewDays(30); setNewHours(0); setNewAccountType('unlimited');
    setNewFeatureAccess(Object.fromEntries(FEATURES.map(f => [f.key, true])));
    setNewFeaturePoints(Object.fromEntries(FEATURES.map(f => [f.key, 0])));
    setNewPointsExpiry('');
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
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const data = await callAdmin({ action: 'extend-duration', userId: selectedUser.user_id, days: extDays, hours: extHours });
      setUsers(prev => prev.map(u => u.user_id === selectedUser.user_id ? { ...u, expires_at: data.new_expires_at } : u));
      toast({ title: isAr ? 'تم تمديد المدة' : 'Duration extended' });
      setExtendOpen(false);
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (user: ManagedUser) => {
    setSelectedUser(user);
    setEditName(user.display_name || '');
    setEditPhone(user.phone || '');
    setEditAccountType(user.account_type || 'unlimited');
    setEditFeatureAccess(user.feature_access || Object.fromEntries(FEATURES.map(f => [f.key, true])));
    const pts: Record<string, number> = {};
    let expiry = '';
    FEATURES.forEach(f => {
      const fp = user.feature_points?.[f.key];
      pts[f.key] = fp?.points || 0;
      if (fp?.expires_at && !expiry) expiry = fp.expires_at.split('T')[0];
    });
    setEditFeaturePoints(pts);
    setEditPointsExpiry(expiry);
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await callAdmin({
        action: 'update-user',
        userId: selectedUser.user_id,
        displayName: editName,
        phone: editPhone,
        accountType: editAccountType,
        featureAccess: editFeatureAccess,
        featurePoints: editAccountType === 'points' ? editFeaturePoints : null,
        pointsExpiresAt: editAccountType === 'points' && editPointsExpiry ? editPointsExpiry : null,
      });
      toast({ title: isAr ? 'تم تحديث البيانات' : 'User updated' });
      setEditOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذا الحساب؟' : 'Delete this account?')) return;
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

  const isExpired = (d: string | null) => d ? new Date(d) < new Date() : false;

  const FeatureAccessSection = ({
    featureAccess, setFeatureAccess, accountType, featurePoints, setFeaturePoints, pointsExpiry, setPointsExpiry
  }: {
    featureAccess: Record<string, boolean>;
    setFeatureAccess: (v: Record<string, boolean>) => void;
    accountType: string;
    featurePoints: Record<string, number>;
    setFeaturePoints: (v: Record<string, number>) => void;
    pointsExpiry: string;
    setPointsExpiry: (v: string) => void;
  }) => (
    <div className="space-y-3">
      <Label className="font-bold">{isAr ? 'الميزات المتاحة' : 'Available Features'}</Label>
      {FEATURES.map(f => (
        <div key={f.key} className="flex items-center justify-between gap-2 py-1">
          <div className="flex items-center gap-2 flex-1">
            <Switch
              checked={featureAccess[f.key] ?? true}
              onCheckedChange={v => setFeatureAccess({ ...featureAccess, [f.key]: v })}
            />
            <span className="text-sm">{isAr ? f.ar : f.en}</span>
            {f.cost > 0 && accountType === 'points' && (
              <span className="text-xs text-muted-foreground">({f.cost} {isAr ? 'نقطة' : 'pts'})</span>
            )}
            {f.cost === 0 && <span className="text-xs text-green-600">{isAr ? '(مجاني)' : '(free)'}</span>}
          </div>
          {accountType === 'points' && f.cost > 0 && featureAccess[f.key] && (
            <Input
              type="number"
              min={0}
              step={0.25}
              className="w-20 h-8 text-sm"
              value={featurePoints[f.key] || 0}
              onChange={e => setFeaturePoints({ ...featurePoints, [f.key]: parseFloat(e.target.value) || 0 })}
            />
          )}
        </div>
      ))}
      {accountType === 'points' && (
        <div className="space-y-2 pt-2 border-t">
          <Label>{isAr ? 'تاريخ انتهاء صلاحية النقاط' : 'Points Expiry Date'}</Label>
          <Input type="date" value={pointsExpiry} onChange={e => setPointsExpiry(e.target.value)} />
        </div>
      )}
    </div>
  );

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {isAr ? 'العودة' : 'Back'}
      </Button>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" /> {isAr ? 'لوحة الإدارة' : 'Admin Dashboard'}
        </h2>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">{isAr ? 'المستخدمون' : 'Users'}</TabsTrigger>
          <TabsTrigger value="contact">{isAr ? 'حسابات التواصل' : 'Contact Info'}</TabsTrigger>
        </TabsList>

        {/* Contact Tab */}
        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>{isAr ? 'حسابات التواصل' : 'Contact Accounts'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> {isAr ? 'رقم الواتساب' : 'WhatsApp Number'}</Label>
                <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+964..." dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Send className="h-4 w-4" /> {isAr ? 'رابط التليكرام' : 'Telegram Link'}</Label>
                <Input value={contactTelegram} onChange={e => setContactTelegram(e.target.value)} placeholder="https://t.me/..." dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Instagram className="h-4 w-4" /> {isAr ? 'رابط الانستغرام' : 'Instagram Link'}</Label>
                <Input value={contactInstagram} onChange={e => setContactInstagram(e.target.value)} placeholder="https://instagram.com/..." dir="ltr" />
              </div>
              <Button onClick={handleSaveContact} disabled={savingContact} className="gap-1">
                {savingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isAr ? 'حفظ' : 'Save'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <div className="flex justify-end mb-4">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1"><UserPlus className="h-4 w-4" /> {isAr ? 'إنشاء حساب' : 'Create Account'}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isAr ? 'إنشاء حساب جديد' : 'Create New Account'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isAr ? 'الاسم' : 'Name'}</Label>
                      <Input value={newName} onChange={e => setNewName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{isAr ? 'البريد' : 'Email'}</Label>
                      <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isAr ? 'الهاتف' : 'Phone'}</Label>
                      <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{isAr ? 'كلمة المرور' : 'Password'}</Label>
                      <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{isAr ? 'أيام' : 'Days'}</Label>
                      <Input type="number" min={0} value={newDays} onChange={e => setNewDays(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{isAr ? 'ساعات' : 'Hours'}</Label>
                      <Input type="number" min={0} value={newHours} onChange={e => setNewHours(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{isAr ? 'نوع الحساب' : 'Account Type'}</Label>
                      <Select value={newAccountType} onValueChange={setNewAccountType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">{isAr ? 'مجاني' : 'Free'}</SelectItem>
                          <SelectItem value="unlimited">{isAr ? 'غير محدود' : 'Unlimited'}</SelectItem>
                          <SelectItem value="points">{isAr ? 'نظام النقاط' : 'Points System'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <FeatureAccessSection
                    featureAccess={newFeatureAccess}
                    setFeatureAccess={setNewFeatureAccess}
                    accountType={newAccountType}
                    featurePoints={newFeaturePoints}
                    setFeaturePoints={setNewFeaturePoints}
                    pointsExpiry={newPointsExpiry}
                    setPointsExpiry={setNewPointsExpiry}
                  />
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
              ) : users.filter(u => !u.roles.includes('admin')).length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">{isAr ? 'لا يوجد مستخدمين' : 'No users'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isAr ? 'الاسم' : 'Name'}</TableHead>
                      <TableHead>{isAr ? 'البريد' : 'Email'}</TableHead>
                      <TableHead>{isAr ? 'النوع' : 'Type'}</TableHead>
                      <TableHead>{isAr ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{isAr ? 'الانتهاء' : 'Expires'}</TableHead>
                      <TableHead>{isAr ? 'الإجراءات' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.filter(u => !u.roles.includes('admin')).map(user => (
                      <TableRow key={user.user_id} className={!user.is_active || isExpired(user.expires_at) ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{user.display_name || '-'}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full ${user.account_type === 'points' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {user.account_type === 'points' ? (isAr ? 'نقاط' : 'Points') : (isAr ? 'غير محدود' : 'Unlimited')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={user.is_active} onCheckedChange={() => handleToggleActive(user.user_id, user.is_active)} />
                            <span className={`text-xs ${user.is_active ? 'text-green-600' : 'text-destructive'}`}>
                              {user.is_active ? (isAr ? 'فعال' : 'Active') : (isAr ? 'معطل' : 'Off')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={isExpired(user.expires_at) ? 'text-destructive font-medium' : ''}>
                            {formatDate(user.expires_at)}
                            {isExpired(user.expires_at) && (isAr ? ' (منتهي)' : ' (exp)')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(user)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => { setSelectedUser(user); setExtDays(0); setExtHours(0); setExtendOpen(true); }}>
                              <Clock className="h-3 w-3" />
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
        </TabsContent>
      </Tabs>

      {/* Extend Dialog */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{isAr ? 'تمديد المدة' : 'Extend Duration'}</DialogTitle></DialogHeader>
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

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isAr ? 'تعديل بيانات المستخدم' : 'Edit User'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isAr ? 'الاسم' : 'Name'}</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{isAr ? 'الهاتف' : 'Phone'}</Label>
                <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{isAr ? 'نوع الحساب' : 'Account Type'}</Label>
              <Select value={editAccountType} onValueChange={setEditAccountType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">{isAr ? 'مجاني' : 'Free'}</SelectItem>
                  <SelectItem value="unlimited">{isAr ? 'غير محدود' : 'Unlimited'}</SelectItem>
                  <SelectItem value="points">{isAr ? 'نظام النقاط' : 'Points System'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FeatureAccessSection
              featureAccess={editFeatureAccess}
              setFeatureAccess={setEditFeatureAccess}
              accountType={editAccountType}
              featurePoints={editFeaturePoints}
              setFeaturePoints={setEditFeaturePoints}
              pointsExpiry={editPointsExpiry}
              setPointsExpiry={setEditPointsExpiry}
            />
            <Button onClick={handleEdit} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'حفظ التعديلات' : 'Save Changes')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
