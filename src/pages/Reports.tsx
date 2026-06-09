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
import { Plus, ArrowLeft, FileSpreadsheet, Trash2, Loader as Loader2, Sparkles, Download, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useUserPlan } from '@/hooks/useUserPlan';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

interface Report {
  id: string;
  title: string;
  status: string;
  report_type: string;
  created_at: string;
  content: any;
  research_language: string;
}

const Reports = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { checkAndConsume } = useFeatureAccess();
  const { isFree } = useUserPlan();
  const { settings } = usePlatformSettings();
  const maxReportPages = isFree ? (settings.plan_free_report_pages || 5) : 20;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);

  const [form, setForm] = useState({
    title: '',
    report_type: 'scientific',
    abstract: '',
    research_language: 'ar',
    text_direction: 'rtl',
    page_count: 3,
    custom_references: '',
    reference_count: 5,
    include_images: false,
    include_tables: false,
  });

  const fetchReports = async () => {
    const { data } = await supabase
      .from('reports')
      .select('id, title, status, report_type, created_at, content, research_language')
      .eq('user_id', user!.id)
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

    // Enforce free-plan page cap
    if (isFree && form.page_count > maxReportPages) {
      toast({
        title: lang === 'ar'
          ? `الخطة المجانية محدودة بـ ${maxReportPages} صفحات للتقرير. تواصل عبر صفحة الاشتراكات للترقية.`
          : `Free plan is limited to ${maxReportPages} pages per report. Upgrade for more.`,
        variant: 'destructive',
      });
      setForm({ ...form, page_count: maxReportPages });
      return;
    }

    // Check points
    const allowed = await checkAndConsume('reports', lang);
    if (!allowed) return;

    const { data, error } = await supabase
      .from('reports')
      .insert({ user_id: user!.id, ...form })
      .select('id')
      .single();
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-report', {
        body: { ...form },
      });
      if (aiError) throw aiError;
      
      const content = aiData?.content || '';
      await supabase.from('reports').update({ content: { _full: content }, status: 'completed' }).eq('id', data.id);
      toast({ title: lang === 'ar' ? 'تم توليد التقرير بنجاح!' : 'Report generated successfully!' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    }
    setGenerating(false);
    setShowForm(false);
    setForm({ title: '', report_type: 'scientific', abstract: '', research_language: 'ar', text_direction: 'rtl', page_count: 3, custom_references: '', reference_count: 5, include_images: false, include_tables: false });
    fetchReports();
  };

  const deleteReport = async (id: string) => {
    await supabase.from('reports').delete().eq('id', id);
    setReports(prev => prev.filter(r => r.id !== id));
  };

  const exportAsPDF = (report: Report) => {
    const content = report.content?._full;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const isRtl = report.research_language === 'ar';
    printWindow.document.write(`
      <html dir="${isRtl ? 'rtl' : 'ltr'}"><head><title>${report.title}</title>
      <style>
        body { font-family: 'Times New Roman', Times, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.8; text-align: justify; }
        h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
        h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; }
        ul, ol { padding-${isRtl ? 'right' : 'left'}: 20px; }
        li { margin-bottom: 5px; }
      </style></head><body>${content}</body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const exportAsWord = (report: Report) => {
    const content = report.content?._full;
    if (!content) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${content}</div>`, 'text/html');
    const paragraphs: Paragraph[] = [];

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) paragraphs.push(new Paragraph({ children: [new TextRun({ text, font: 'Times New Roman', size: 24 })], alignment: AlignmentType.JUSTIFIED }));
        return;
      }
      const el = node as HTMLElement;
      const tag = el.tagName?.toLowerCase();
      const text = el.textContent?.trim() || '';
      if (!text) return;
      if (tag === 'h1') {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text, font: 'Times New Roman', size: 32, bold: true })], heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
      } else if (tag === 'h2') {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text, font: 'Times New Roman', size: 26, bold: true })], heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      } else if (tag === 'ul' || tag === 'ol') {
        el.querySelectorAll('li').forEach(li => {
          paragraphs.push(new Paragraph({ children: [new TextRun({ text: `• ${li.textContent?.trim()}`, font: 'Times New Roman', size: 24 })], spacing: { after: 50 } }));
        });
      } else {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text, font: 'Times New Roman', size: 24 })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 } }));
      }
    };

    doc.body.firstElementChild?.childNodes.forEach(processNode);
    const wordDoc = new Document({ sections: [{ children: paragraphs }] });
    Packer.toBlob(wordDoc).then(blob => saveAs(blob, `${report.title || 'report'}.docx`));
  };

  return (
    <div className="min-h-screen bg-background" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-green-500/5" />
        <div className="container mx-auto max-w-4xl px-4 py-6 relative">
          <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-3 -ms-2">
            <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
          </Button>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10"><FileSpreadsheet className="h-6 w-6 text-emerald-600" /></div>
              <div>
                <h2 className="text-2xl font-bold">{t('myReports')}</h2>
                <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'التقارير العلمية والمختبرية' : 'Scientific & lab reports'}</p>
              </div>
            </div>
            <Button onClick={() => setShowForm(!showForm)} className="gap-2">
              <Plus className="h-4 w-4" /> {t('newReport')}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-6">

      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>{t('reportTitle')}</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Input type="number" min={1} max={maxReportPages} value={form.page_count} onChange={e => setForm({ ...form, page_count: parseInt(e.target.value) || 3 })} />
                {isFree && <p className="text-xs text-muted-foreground">{lang === 'ar' ? `الحد الأقصى للخطة المجانية: ${maxReportPages} صفحات` : `Free plan max: ${maxReportPages} pages`}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('referenceCount')}</Label>
                <Input type="number" min={1} max={30} value={form.reference_count} onChange={e => setForm({ ...form, reference_count: parseInt(e.target.value) || 5 })} />
              </div>
            </div>
            <div className="space-y-3 border-t pt-4">
              <Label>{lang === 'ar' ? 'خيارات المحتوى' : 'Content Options'}</Label>
              <div className="flex items-center gap-2">
                <Checkbox id="rep_images" checked={form.include_images} onCheckedChange={(v) => setForm({ ...form, include_images: !!v })} />
                <label htmlFor="rep_images" className="text-sm cursor-pointer">{lang === 'ar' ? 'إضافة صور توضيحية مع عناوين' : 'Add illustrative images with captions'}</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="rep_tables" checked={form.include_tables} onCheckedChange={(v) => setForm({ ...form, include_tables: !!v })} />
                <label htmlFor="rep_tables" className="text-sm cursor-pointer">{lang === 'ar' ? 'إضافة جداول بيانات' : 'Add data tables'}</label>
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
                <div className="cursor-pointer" onClick={() => r.content?._full && setPreviewReport(r)}>
                  <CardTitle className="text-lg">{r.title || t('newReport')}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {r.report_type === 'lab' ? t('labReport') : t('scientificReport')} • {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={r.status === 'completed' ? 'default' : 'outline'}>
                    {t(r.status as any)}
                  </Badge>
                  {r.content?._full && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => exportAsPDF(r)} className="gap-1">
                        <Download className="h-3 w-3" /> PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportAsWord(r)} className="gap-1">
                        <Download className="h-3 w-3" /> Word
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => deleteReport(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Report Preview Modal */}
      {previewReport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreviewReport(null)}>
          <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold">{previewReport.title}</h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => exportAsPDF(previewReport)} className="gap-1">
                  <Download className="h-3 w-3" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportAsWord(previewReport)} className="gap-1">
                  <Download className="h-3 w-3" /> Word
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPreviewReport(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="border-2 border-border rounded-lg p-8 bg-card shadow-inner mx-auto max-w-[800px]">
                <div
                  className="generated-content prose max-w-none"
                  dir={previewReport.research_language === 'ar' ? 'rtl' : 'ltr'}
                  dangerouslySetInnerHTML={{ __html: previewReport.content?._full || '' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Reports;
