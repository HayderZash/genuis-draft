import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, ArrowLeft, GraduationCap, Trash2, Loader as Loader2, Sparkles, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

interface Thesis {
  id: string;
  title: string;
  thesis_type: string;
  field_of_study: string;
  university: string;
  status: string;
  created_at: string;
  research_language: string;
  content: any;
}

const Theses = () => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { checkAndConsume } = useFeatureAccess();
  const [list, setList] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Thesis | null>(null);
  const [generating, setGenerating] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [thesisType, setThesisType] = useState('master');
  const [field, setField] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [university, setUniversity] = useState('');
  const [abstract, setAbstract] = useState('');
  const [language, setLanguage] = useState('ar');
  const [refCount, setRefCount] = useState(30);

  const fetchList = async () => {
    const { data } = await supabase.from('theses').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    if (data) setList(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchList(); }, []);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleCreate = async () => {
    if (!title.trim() || !field.trim()) {
      toast({ title: lang === 'ar' ? 'العنوان والتخصص مطلوبان' : 'Title and field are required', variant: 'destructive' });
      return;
    }
    const allowed = await checkAndConsume('thesis', lang);
    if (!allowed) return;

    setGenerating(true);
    try {
      const chapterCount = thesisType === 'phd' ? 7 : 5;
      const finalRefs = thesisType === 'phd' ? Math.max(refCount, 60) : Math.max(refCount, 30);

      const { data: inserted, error: insErr } = await supabase.from('theses').insert({
        user_id: user!.id,
        title,
        thesis_type: thesisType,
        field_of_study: field,
        supervisor,
        university,
        abstract,
        research_language: language,
        text_direction: language === 'ar' ? 'rtl' : 'ltr',
        chapter_count: chapterCount,
        reference_count: finalRefs,
        status: 'generating',
      }).select().single();
      if (insErr) throw insErr;

      const { data, error } = await supabase.functions.invoke('generate-thesis', {
        body: {
          title, thesisType, field, supervisor, university, abstract,
          language, chapterCount, referenceCount: finalRefs,
        },
      });
      if (error) throw error;

      await supabase.from('theses').update({
        content: data.content || {},
        chapters: data.chapters || [],
        status: 'completed',
      }).eq('id', inserted.id);

      toast({ title: lang === 'ar' ? 'تم توليد الرسالة بنجاح' : 'Thesis generated successfully' });
      setCreateOpen(false);
      setTitle(''); setField(''); setSupervisor(''); setUniversity(''); setAbstract('');
      fetchList();
    } catch (e: any) {
      toast({ title: e.message || 'Error', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const deleteThesis = async (id: string) => {
    await supabase.from('theses').delete().eq('id', id);
    setList(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {lang === 'ar' ? 'العودة' : 'Back'}
      </Button>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10"><GraduationCap className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">{lang === 'ar' ? 'رسائل الدراسات العليا' : 'Graduate Theses'}</h1>
            <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'ماجستير ودكتوراه بمنهجية بحثية ومصادر معتمدة (5 نقاط/رسالة)' : 'Master & PhD with research methodology and verified sources (5 pts/thesis)'}</p>
          </div>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> {lang === 'ar' ? 'رسالة جديدة' : 'New Thesis'}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{lang === 'ar' ? 'إنشاء رسالة جديدة' : 'Create New Thesis'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{lang === 'ar' ? 'النوع' : 'Type'}</Label>
                  <Select value={thesisType} onValueChange={setThesisType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="master">{lang === 'ar' ? 'ماجستير' : 'Master'}</SelectItem>
                      <SelectItem value="phd">{lang === 'ar' ? 'دكتوراه' : 'PhD'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{lang === 'ar' ? 'اللغة' : 'Language'}</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ar">العربية</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'عنوان الرسالة' : 'Thesis Title'} *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'التخصص' : 'Field of Study'} *</Label>
                <Input value={field} onChange={e => setField(e.target.value)} placeholder={lang === 'ar' ? 'مثال: هندسة الحاسوب' : 'e.g. Computer Engineering'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{lang === 'ar' ? 'المشرف' : 'Supervisor'}</Label>
                  <Input value={supervisor} onChange={e => setSupervisor(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{lang === 'ar' ? 'الجامعة' : 'University'}</Label>
                  <Input value={university} onChange={e => setUniversity(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'عدد المراجع' : 'References Count'} ({refCount})</Label>
                <Input type="number" min={20} max={150} value={refCount} onChange={e => setRefCount(parseInt(e.target.value) || 30)} />
                <p className="text-xs text-muted-foreground">
                  {lang === 'ar' ? `الحد الأدنى: ${thesisType === 'phd' ? 60 : 30}` : `Minimum: ${thesisType === 'phd' ? 60 : 30}`}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'فكرة الرسالة / الملخص' : 'Idea / Abstract'}</Label>
                <Textarea value={abstract} onChange={e => setAbstract(e.target.value)} rows={5} dir={language === 'ar' ? 'rtl' : 'ltr'} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={generating}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleCreate} disabled={generating} className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? (lang === 'ar' ? 'جاري التوليد...' : 'Generating...') : (lang === 'ar' ? 'توليد الرسالة' : 'Generate')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">...</div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>{lang === 'ar' ? 'لا توجد رسائل بعد' : 'No theses yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map(thesis => (
            <Card key={thesis.id} className="hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base truncate">{thesis.title || (lang === 'ar' ? 'بدون عنوان' : 'Untitled')}</CardTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{thesis.thesis_type === 'phd' ? (lang === 'ar' ? 'دكتوراه' : 'PhD') : (lang === 'ar' ? 'ماجستير' : 'Master')}</Badge>
                    <Badge variant="outline" className="text-xs">{thesis.field_of_study}</Badge>
                    <Badge variant={thesis.status === 'completed' ? 'default' : 'secondary'} className="text-xs">{thesis.status}</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setViewing(thesis)} disabled={thesis.status !== 'completed'}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteThesis(thesis.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing?.content && (
            <div
              className="generated-content prose prose-sm max-w-none"
              dir={viewing.research_language === 'ar' ? 'rtl' : 'ltr'}
              dangerouslySetInnerHTML={{ __html: typeof viewing.content === 'string' ? viewing.content : (viewing.content.html || JSON.stringify(viewing.content, null, 2)) }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Theses;
