import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ClipboardList, Loader2, Sparkles, Trash2, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

interface ExamRow {
  id: string;
  title: string;
  question_count: number;
  language: string;
  status: string;
  created_at: string;
  generated_questions: any;
}

const QUESTION_TYPES = [
  { key: 'mcq', ar: 'اختيار من متعدد', en: 'Multiple Choice' },
  { key: 'tf', ar: 'صح / خطأ', en: 'True / False' },
  { key: 'essay', ar: 'مقالي', en: 'Essay' },
  { key: 'fill', ar: 'إكمال الفراغ', en: 'Fill in the Blank' },
];

const ExamExpert = () => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { checkAndConsume } = useFeatureAccess();

  const [list, setList] = useState<ExamRow[]>([]);
  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [language, setLanguage] = useState('ar');
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<string[]>(['mcq']);
  const [generating, setGenerating] = useState(false);
  const [current, setCurrent] = useState<ExamRow | null>(null);

  const fetchList = async () => {
    const { data } = await supabase.from('exam_papers').select('*').order('created_at', { ascending: false });
    if (data) setList(data as any);
  };

  useEffect(() => { fetchList(); }, []);

  const toggleType = (key: string) => {
    setTypes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.txt')) {
      setSourceText(await file.text());
    } else {
      toast({ title: lang === 'ar' ? 'يرجى نسخ النص ولصقه' : 'Please copy the text and paste it' });
    }
  };

  const handleGenerate = async () => {
    if (!sourceText.trim() || count < 1 || types.length === 0) {
      toast({ title: lang === 'ar' ? 'أكمل جميع الحقول' : 'Complete all fields', variant: 'destructive' });
      return;
    }
    // Cost is enforced server-side via checkAndConsume; here we display only.
    const allowed = await checkAndConsume('exam_expert', lang);
    if (!allowed) return;

    setGenerating(true);
    try {
      const { data: inserted, error: insErr } = await supabase.from('exam_papers').insert({
        user_id: user!.id,
        title: title || (lang === 'ar' ? 'امتحان جديد' : 'New Exam'),
        source_text: sourceText,
        question_count: count,
        question_types: types,
        difficulty,
        language,
        status: 'generating',
      }).select().single();
      if (insErr) throw insErr;

      const { data, error } = await supabase.functions.invoke('generate-exam', {
        body: { sourceText, count, types, difficulty, language },
      });
      if (error) throw error;

      await supabase.from('exam_papers').update({
        generated_questions: data.questions || [],
        status: 'completed',
      }).eq('id', inserted.id);

      toast({ title: lang === 'ar' ? `تم توليد ${data.questions?.length || 0} سؤال` : `${data.questions?.length || 0} questions generated` });
      setCurrent({ ...inserted, generated_questions: data.questions, status: 'completed' } as any);
      setTitle(''); setSourceText('');
      fetchList();
    } catch (e: any) {
      toast({ title: e.message || 'Error', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const deleteRow = async (id: string) => {
    await supabase.from('exam_papers').delete().eq('id', id);
    setList(prev => prev.filter(r => r.id !== id));
    if (current?.id === id) setCurrent(null);
  };

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {lang === 'ar' ? 'العودة' : 'Back'}
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-primary/10"><ClipboardList className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{lang === 'ar' ? 'خبير الامتحانات' : 'Exam Expert'}</h1>
          <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'كل سؤال يستهلك 0.01 نقطة' : 'Each question costs 0.01 points'}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>{lang === 'ar' ? 'إنشاء امتحان جديد' : 'Create New Exam'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{lang === 'ar' ? 'العنوان' : 'Title'}</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={lang === 'ar' ? 'عنوان الامتحان' : 'Exam title'} />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'الصعوبة' : 'Difficulty'}</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">{lang === 'ar' ? 'سهل' : 'Easy'}</SelectItem>
                    <SelectItem value="medium">{lang === 'ar' ? 'متوسط' : 'Medium'}</SelectItem>
                    <SelectItem value="hard">{lang === 'ar' ? 'صعب' : 'Hard'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{lang === 'ar' ? 'عدد الأسئلة' : 'Question Count'} ({count})</Label>
              <Input type="number" min={1} max={100} value={count} onChange={e => setCount(parseInt(e.target.value) || 1)} />
              <p className="text-xs text-muted-foreground">
                {lang === 'ar' ? `التكلفة: ${(count * 0.01).toFixed(2)} نقطة` : `Cost: ${(count * 0.01).toFixed(2)} points`}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{lang === 'ar' ? 'أنواع الأسئلة' : 'Question Types'}</Label>
              <div className="grid grid-cols-2 gap-2">
                {QUESTION_TYPES.map(qt => (
                  <label key={qt.key} className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted">
                    <Checkbox checked={types.includes(qt.key)} onCheckedChange={() => toggleType(qt.key)} />
                    <span className="text-sm">{qt[lang as 'ar' | 'en']}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{lang === 'ar' ? 'المحتوى المصدر' : 'Source Content'}</Label>
              <label className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted w-fit">
                <Upload className="h-4 w-4" />
                <span className="text-sm">{lang === 'ar' ? 'رفع ملف نصي' : 'Upload .txt'}</span>
                <input type="file" accept=".txt" className="hidden" onChange={handleFile} />
              </label>
              <Textarea
                value={sourceText}
                onChange={e => setSourceText(e.target.value)}
                rows={8}
                placeholder={lang === 'ar' ? 'الصق المحاضرة أو الموضوع هنا...' : 'Paste lecture or topic here...'}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>

            <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? (lang === 'ar' ? 'جاري التوليد...' : 'Generating...') : (lang === 'ar' ? 'توليد الأسئلة' : 'Generate Questions')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{current ? (lang === 'ar' ? 'الأسئلة المولدة' : 'Generated Questions') : (lang === 'ar' ? 'الامتحانات السابقة' : 'Previous Exams')}</CardTitle></CardHeader>
          <CardContent>
            {current ? (
              <div className="space-y-3 max-h-[600px] overflow-y-auto" dir={current.language === 'ar' ? 'rtl' : 'ltr'}>
                <Button variant="outline" size="sm" onClick={() => setCurrent(null)}>
                  {lang === 'ar' ? '← القائمة' : '← List'}
                </Button>
                {(current.generated_questions as any[])?.map((q, i) => (
                  <div key={i} className="p-3 border rounded-md space-y-2">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline">{i + 1}</Badge>
                      <Badge variant="secondary" className="text-xs">{q.type}</Badge>
                    </div>
                    <div className="font-medium text-sm">{q.question}</div>
                    {q.options && (
                      <ul className="text-sm space-y-1 ms-4">
                        {q.options.map((o: string, j: number) => <li key={j}>{String.fromCharCode(65 + j)}. {o}</li>)}
                      </ul>
                    )}
                    <div className="text-sm text-emerald-600 font-medium">
                      {lang === 'ar' ? 'الإجابة: ' : 'Answer: '}{q.answer}
                    </div>
                    {q.explanation && <div className="text-xs text-muted-foreground">{q.explanation}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">{lang === 'ar' ? 'لا توجد امتحانات بعد' : 'No exams yet'}</p>
                ) : list.map(row => (
                  <div key={row.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => setCurrent(row)}>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{row.title}</div>
                      <div className="text-xs text-muted-foreground">{row.question_count} {lang === 'ar' ? 'سؤال' : 'questions'} • {new Date(row.created_at).toLocaleDateString()}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteRow(row.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExamExpert;
