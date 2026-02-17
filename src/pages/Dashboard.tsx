import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Trash2, CheckCircle, FileSpreadsheet, UserCircle, BookOpen, Languages, Presentation, ShieldCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CompletedItem {
  id: string;
  title: string;
  type: 'research' | 'report' | 'cv';
  status: string;
  created_at: string;
}

const Dashboard = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllItems = async () => {
    const [researchRes, reportsRes, cvsRes] = await Promise.all([
      supabase.from('research_projects').select('id, title, status, created_at').order('updated_at', { ascending: false }),
      supabase.from('reports').select('id, title, status, created_at').order('updated_at', { ascending: false }),
      supabase.from('cvs').select('id, full_name, status, created_at').order('updated_at', { ascending: false }),
    ]);

    const allItems: CompletedItem[] = [];

    if (researchRes.data) {
      researchRes.data.forEach(p => allItems.push({ id: p.id, title: p.title || (lang === 'ar' ? 'بحث جديد' : 'New Research'), type: 'research', status: p.status, created_at: p.created_at }));
    }
    if (reportsRes.data) {
      reportsRes.data.forEach(r => allItems.push({ id: r.id, title: r.title || (lang === 'ar' ? 'تقرير جديد' : 'New Report'), type: 'report', status: r.status, created_at: r.created_at }));
    }
    if (cvsRes.data) {
      cvsRes.data.forEach(c => allItems.push({ id: c.id, title: c.full_name || (lang === 'ar' ? 'سيرة ذاتية' : 'CV'), type: 'cv', status: c.status, created_at: c.created_at }));
    }

    allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setItems(allItems);
    setLoading(false);
  };

  useEffect(() => { fetchAllItems(); }, []);

  const goToResearch = () => {
    navigate('/research');
  };

  const deleteItem = async (item: CompletedItem) => {
    if (item.type === 'research') {
      await supabase.from('research_projects').delete().eq('id', item.id);
    } else if (item.type === 'report') {
      await supabase.from('reports').delete().eq('id', item.id);
    } else {
      await supabase.from('cvs').delete().eq('id', item.id);
    }
    setItems(prev => prev.filter(i => !(i.id === item.id && i.type === item.type)));
  };

  const openItem = (item: CompletedItem) => {
    if (item.type === 'research') navigate(`/project/${item.id}`);
    else if (item.type === 'report') navigate('/reports');
    else navigate('/cvs');
  };

  const typeLabel = (type: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      research: { ar: 'بحث أكاديمي', en: 'Research' },
      report: { ar: 'تقرير', en: 'Report' },
      cv: { ar: 'سيرة ذاتية', en: 'CV' },
    };
    return labels[type]?.[lang] || type;
  };

  const statusVariant = (s: string) => s === 'completed' ? 'default' : s === 'generating' ? 'secondary' : 'outline';

  const features = [
    {
      key: 'research',
      icon: FileText,
      title: t('researchProjects'),
      desc: t('researchProjectsDesc'),
      color: 'text-primary',
      bg: 'bg-primary/10',
      onClick: goToResearch,
    },
    {
      key: 'proofreading',
      icon: CheckCircle,
      title: t('proofreading'),
      desc: t('proofreadingDesc'),
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      onClick: () => navigate('/proofreading'),
    },
    {
      key: 'report',
      icon: FileSpreadsheet,
      title: t('createReport'),
      desc: t('createReportDesc'),
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      onClick: () => navigate('/reports'),
    },
    {
      key: 'cv',
      icon: UserCircle,
      title: t('createCV'),
      desc: t('createCVDesc'),
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      onClick: () => navigate('/cvs'),
    },
    {
      key: 'summarize',
      icon: BookOpen,
      title: t('summarizeText'),
      desc: t('summarizeTextDesc'),
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
      onClick: () => toast({ title: lang === 'ar' ? 'قريباً!' : 'Coming soon!' }),
    },
    {
      key: 'translate',
      icon: Languages,
      title: t('academicTranslation'),
      desc: t('academicTranslationDesc'),
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      onClick: () => toast({ title: lang === 'ar' ? 'قريباً!' : 'Coming soon!' }),
    },
    {
      key: 'presentation',
      icon: Presentation,
      title: t('presentationGenerator'),
      desc: t('presentationGeneratorDesc'),
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      onClick: () => toast({ title: lang === 'ar' ? 'قريباً!' : 'Coming soon!' }),
    },
    {
      key: 'plagiarism',
      icon: ShieldCheck,
      title: t('plagiarismChecker'),
      desc: t('plagiarismCheckerDesc'),
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      onClick: () => toast({ title: lang === 'ar' ? 'قريباً!' : 'Coming soon!' }),
    },
  ];

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      {/* Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {features.map(f => (
          <Card
            key={f.key}
            className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary/30"
            onClick={f.onClick}
          >
            <CardContent className="pt-6 pb-4 text-center">
              <div className={`inline-flex p-3 rounded-xl ${f.bg} mb-3`}>
                <f.icon className={`h-7 w-7 ${f.color}`} />
              </div>
              <h3 className="font-semibold text-sm">{f.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Completed Projects Section */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('completedProjects')}</h2>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">...</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>{t('noProjects')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map(item => (
            <Card key={`${item.type}-${item.id}`} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openItem(item)}>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {typeLabel(item.type)} • {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(item.status)}>
                    {t(item.status as any)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); deleteItem(item); }}
                  >
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

function getDefaultChapters(count: number) {
  const five = [
    { name: 'Introduction', nameAr: 'المقدمة' },
    { name: 'Literature Review', nameAr: 'الإطار النظري والدراسات السابقة' },
    { name: 'Methodology', nameAr: 'المنهجية' },
    { name: 'Results & Discussion', nameAr: 'النتائج والمناقشة' },
    { name: 'Conclusion', nameAr: 'الخاتمة' },
  ];
  if (count === 5) return five;
  if (count === 4) return five.slice(0, 4);
  return [...five, { name: 'Recommendations', nameAr: 'التوصيات' }];
}

export { getDefaultChapters };
export default Dashboard;
