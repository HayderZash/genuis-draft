import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowLeft, FileSpreadsheet, Trash2, Loader2, Sparkles, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Report {
  id: string;
  title: string;
  status: string;
  report_type: string;
  created_at: string;
}

const Reports = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [form, setForm] = useState({
    title: '',
    report_type: 'scientific',
    abstract: '',
    research_language: 'ar',
    text_direction: 'rtl',
    page_count: 3,
    custom_references: '',
    reference_count: 5,
  });

  const fetchReports = async () => {
    const { data } = await supabase
      .from('reports')
      .select('id, title, status, report_type, created_at')
      .order('updated_at', { ascending: false });
    if (data) setReports(data);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const createReport = async () => {
    if (!form.title.trim()) {
      toast({ title: lang === 'ar' ? 'يرجى إدخال عنوان التقرير' : 'Please enter report title', variant: 'destructive' });
      return;
    }
    const { data, error } = await supabase
      .from('reports')
      .insert({ user_id: user!.id, ...form })
      .select('id')
      .single();
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }
    // Generate report content
    setGenerating(true);
    try {
      const provider = (localStorage.getItem('ai_provider') as 'openai' | 'gemini' | 'groq') || 'openai';
      const keyMap: Record<string, string> = { gemini: 'gemini_api_key', openai: 'openai_api_key', groq: 'groq_api_key' };
      const apiKey = localStorage.getItem(keyMap[provider]);
      if (!apiKey) {
        toast({ title: t('apiKeyRequired'), variant: 'destructive' });
        setGenerating(false);
        navigate(`/reports`);
        return;
      }
      // Simple generation via existing AI
      const { callAIForReport } = await import('@/lib/report-generation');
      const content = await callAIForReport({ ...form, provider, apiKey });
      await supabase.from('reports').update({ content, status: 'completed' }).eq('id', data.id);
      toast({ title: lang === 'ar' ? 'تم توليد التقرير بنجاح!' : 'Report generated successfully!' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    }
    setGenerating(false);
    setShowForm(false);
    setForm({ title: '', report_type: 'scientific', abstract: '', research_language: 'ar', text_direction: 'rtl', page_count: 3, custom_references: '', reference_count: 5 });
    fetchReports();
  };

  const deleteReport = async (id: string) => {
    await supabase.from('reports').delete().eq('id', id);
    setReports(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
      </Button>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('myReports')}</h2>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" /> {t('newReport')}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>{t('reportTitle')}</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('reportType')}</Label>
                <Select value={form.report_type} onValueChange={v => setForm({ ...form, report_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scientific">{t('scientificReport')}</SelectItem>
                    <SelectItem value="lab">{t('labReport')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('researchLanguage')}</Label>
                <Select value={form.research_language} onValueChange={v => setForm({ ...form, research_language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">{t('arabic')}</SelectItem>
                    <SelectItem value="en">{t('english')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('researchAbstract')}</Label>
              <Textarea value={form.abstract} onChange={e => setForm({ ...form, abstract: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('pageCount')}</Label>
                <Input type="number" min={1} max={20} value={form.page_count} onChange={e => setForm({ ...form, page_count: parseInt(e.target.value) || 3 })} />
              </div>
              <div className="space-y-2">
                <Label>{t('referenceCount')}</Label>
                <Input type="number" min={1} max={30} value={form.reference_count} onChange={e => setForm({ ...form, reference_count: parseInt(e.target.value) || 5 })} />
              </div>
            </div>
            <Button onClick={createReport} disabled={generating} className="gap-2 w-full">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? t('generating') : t('generateReport')}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-12">...</div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>{t('noReports')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map(r => (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-lg">{r.title || t('newReport')}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {r.report_type === 'lab' ? t('labReport') : t('scientificReport')} • {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === 'completed' ? 'default' : 'outline'}>
                    {t(r.status as any)}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => deleteReport(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reports;
