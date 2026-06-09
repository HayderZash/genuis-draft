import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Trash2, CircleCheck as CheckCircle, FileSpreadsheet, CircleUser as UserCircle, BookOpen, Languages, Bot, ShieldCheck, Image as ImageIcon, Search, Sparkles, ArrowUpRight, Zap, LayoutGrid, GraduationCap, ClipboardList, RefreshCw, Crown } from 'lucide-react';
import { PointsPanel } from '@/components/PointsPanel';
import { useUserPlan } from '@/hooks/useUserPlan';

export const getDefaultChapters = (count: number) => {
  const titles = [
    { name: 'Introduction', nameAr: 'المقدمة' },
    { name: 'Literature Review', nameAr: 'الإطار النظري' },
    { name: 'Methodology', nameAr: 'منهجية البحث' },
    { name: 'Results', nameAr: 'النتائج' },
    { name: 'Discussion', nameAr: 'المناقشة' },
    { name: 'Conclusion', nameAr: 'الخاتمة والتوصيات' },
  ];
  return titles.slice(0, count);
};

interface CompletedItem {
  id: string;
  title: string;
  type: 'research' | 'report' | 'cv' | 'thesis';
  status: string;
  created_at: string;
}

const FEATURE_COLORS = [
  { bg: 'from-blue-500/10 to-cyan-500/10', icon: 'text-blue-600', hover: 'hover:border-blue-300/50' },
  { bg: 'from-emerald-500/10 to-green-500/10', icon: 'text-emerald-600', hover: 'hover:border-emerald-300/50' },
  { bg: 'from-amber-500/10 to-yellow-500/10', icon: 'text-amber-600', hover: 'hover:border-amber-300/50' },
  { bg: 'from-orange-500/10 to-red-500/10', icon: 'text-orange-600', hover: 'hover:border-orange-300/50' },
  { bg: 'from-rose-500/10 to-pink-500/10', icon: 'text-rose-600', hover: 'hover:border-rose-300/50' },
  { bg: 'from-teal-500/10 to-cyan-500/10', icon: 'text-teal-600', hover: 'hover:border-teal-300/50' },
  { bg: 'from-sky-500/10 to-blue-500/10', icon: 'text-sky-600', hover: 'hover:border-sky-300/50' },
  { bg: 'from-violet-500/10 to-purple-500/10', icon: 'text-violet-600', hover: 'hover:border-violet-300/50' },
];

const FEATURE_DESCRIPTIONS: Record<string, { ar: string; en: string }> = {
  research: { ar: 'بحوث أكاديمية مع فصول ومراجع', en: 'Academic research with chapters & references' },
  proofreading: { ar: 'تدقيق لغوي وكشف الاستلال', en: 'Proofreading & plagiarism detection' },
  report: { ar: 'تقارير علمية واحترافية', en: 'Scientific & professional reports' },
  cv: { ar: 'سيرة ذاتية متوافقة مع ATS', en: 'ATS-compatible CV builder' },
  summarize: { ar: 'تلخيص ذكي للنصوص', en: 'Smart text summarization' },
  translate: { ar: 'ترجمة أكاديمية دقيقة', en: 'Precise academic translation' },
  thesis: { ar: 'رسائل ماجستير ودكتوراه', en: 'Master & PhD theses' },
  exam: { ar: 'توليد أسئلة امتحانية', en: 'Generate exam questions' },
};

const safeQuery = async <T,>(p: PromiseLike<{ data: T | null; error: any }>, ms = 15000): Promise<T[]> => {
  return new Promise<T[]>((resolve) => {
    let done = false;
    const timer = window.setTimeout(() => { if (!done) { done = true; resolve([]); } }, ms);
    Promise.resolve(p).then(({ data }) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve(Array.isArray(data) ? (data as any) : []);
    }).catch(() => {
      if (!done) { done = true; window.clearTimeout(timer); resolve([]); }
    });
  });
};

const Dashboard = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isFree, accountType } = useUserPlan();
  const [items, setItems] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const cacheKey = user ? `dashboard_items_cache_${user.id}` : null;

  const fetchAllItems = async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true);
    if (cacheKey) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CompletedItem[];
          if (Array.isArray(parsed) && parsed.length) { setItems(parsed); setLoading(false); }
        } catch {}
      }
    }
    const [research, reports, cvs, theses] = await Promise.all([
      safeQuery<any>(supabase.from('research_projects').select('id, title, status, created_at').eq('user_id', user.id).order('updated_at', { ascending: false })),
      safeQuery<any>(supabase.from('reports').select('id, title, status, created_at').eq('user_id', user.id).order('updated_at', { ascending: false })),
      safeQuery<any>(supabase.from('cvs').select('id, full_name, status, created_at').eq('user_id', user.id).order('updated_at', { ascending: false })),
      safeQuery<any>(supabase.from('theses').select('id, title, status, created_at').eq('user_id', user.id).order('updated_at', { ascending: false })),
    ]);
    const all: CompletedItem[] = [];
    research.forEach((p: any) => all.push({ id: p.id, title: p.title || (lang === 'ar' ? 'بحث جديد' : 'New Research'), type: 'research', status: p.status, created_at: p.created_at }));
    reports.forEach((x: any) => all.push({ id: x.id, title: x.title || (lang === 'ar' ? 'تقرير جديد' : 'New Report'), type: 'report', status: x.status, created_at: x.created_at }));
    cvs.forEach((c: any) => all.push({ id: c.id, title: c.full_name || (lang === 'ar' ? 'سيرة ذاتية' : 'CV'), type: 'cv', status: c.status, created_at: c.created_at }));
    theses.forEach((th: any) => all.push({ id: th.id, title: th.title || (lang === 'ar' ? 'رسالة جديدة' : 'New Thesis'), type: 'thesis', status: th.status, created_at: th.created_at }));
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setItems(all);
    setLoading(false);
    if (cacheKey && all.length) localStorage.setItem(cacheKey, JSON.stringify(all));
  };

  useEffect(() => { fetchAllItems(); }, [user?.id]);

  const deleteItem = async (item: CompletedItem) => {
    const table = item.type === 'research' ? 'research_projects' : item.type === 'report' ? 'reports' : item.type === 'thesis' ? 'theses' : 'cvs';
    await supabase.from(table as any).delete().eq('id', item.id);
    setItems(prev => prev.filter(i => !(i.id === item.id && i.type === item.type)));
  };

  const openItem = (item: CompletedItem) => {
    if (item.type === 'research') navigate(`/project/${item.id}`);
    else if (item.type === 'report') navigate('/reports');
    else if (item.type === 'thesis') navigate('/theses');
    else navigate('/cvs');
  };

  const typeLabel = (type: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      research: { ar: 'بحث', en: 'Research' },
      report: { ar: 'تقرير', en: 'Report' },
      cv: { ar: 'سيرة ذاتية', en: 'CV' },
      thesis: { ar: 'رسالة', en: 'Thesis' },
    };
    return labels[type]?.[lang] || type;
  };

  const typeIcon = (type: string) => {
    const icons: Record<string, any> = { research: FileText, report: FileSpreadsheet, cv: UserCircle, thesis: GraduationCap };
    return icons[type] || FileText;
  };

  const features = [
    { key: 'research', icon: FileText, title: lang === 'ar' ? 'البحوث الأكاديمية' : 'Academic Research', onClick: () => navigate('/research') },
    { key: 'thesis', icon: GraduationCap, title: lang === 'ar' ? 'رسائل الدراسات العليا' : 'Graduate Theses', onClick: () => navigate('/theses'), locked: isFree },
    { key: 'report', icon: FileSpreadsheet, title: lang === 'ar' ? 'التقارير العلمية' : 'Scientific Reports', onClick: () => navigate('/reports') },
    { key: 'exam', icon: ClipboardList, title: lang === 'ar' ? 'خبير الامتحانات' : 'Exam Expert', onClick: () => navigate('/exam-expert') },
    { key: 'proofreading', icon: ShieldCheck, title: lang === 'ar' ? 'التدقيق والكشف الأكاديمي' : 'Academic Proofreading', onClick: () => navigate('/proofreading'), locked: isFree },
    { key: 'cv', icon: UserCircle, title: lang === 'ar' ? 'السيرة الذاتية' : 'CV Builder', onClick: () => navigate('/cvs'), locked: isFree },
    { key: 'summarize', icon: BookOpen, title: lang === 'ar' ? 'تلخيص النصوص' : 'Summarizer', onClick: () => navigate('/summarizer') },
    { key: 'translate', icon: Languages, title: lang === 'ar' ? 'الترجمة الأكاديمية' : 'Translation', onClick: () => navigate('/translator') },
  ];

  const filtered = items.filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()));

  const planBadge = () => {
    if (accountType === 'free') return <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30"><Zap className="h-3 w-3" />{lang === 'ar' ? 'مجاني' : 'Free'}</Badge>;
    if (accountType === 'unlimited') return <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"><Crown className="h-3 w-3" />{lang === 'ar' ? 'غير محدود' : 'Unlimited'}</Badge>;
    return <Badge variant="outline" className="gap-1 text-primary border-primary/30 bg-primary/5"><Zap className="h-3 w-3" />{lang === 'ar' ? 'نقاط' : 'Points'}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-sky-500/5" />
        <div className="container mx-auto max-w-6xl px-4 py-8 relative">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-primary/10"><Sparkles className="h-5 w-5 text-primary" /></div>
                <h1 className="text-2xl font-bold tracking-tight">{lang === 'ar' ? 'مرحبًا بك' : 'Welcome'}</h1>
              </div>
              <p className="text-muted-foreground max-w-lg">
                {lang === 'ar' ? 'أدواتك الأكاديمية الذكية — بحوث، تقارير، ترجمة والمزيد.' : 'Your smart academic tools — research, reports, translation & more.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {planBadge()}
              <Button variant="outline" size="sm" onClick={fetchAllItems} disabled={loading} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{lang === 'ar' ? 'تحديث' : 'Refresh'}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-6 space-y-8">
        <PointsPanel />

        {/* Feature cards */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">{lang === 'ar' ? 'الأدوات المتاحة' : 'Available Tools'}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {features.map((f, idx) => {
              const color = FEATURE_COLORS[idx % FEATURE_COLORS.length];
              const Icon = f.icon;
              const desc = FEATURE_DESCRIPTIONS[f.key];
              return (
                <Card
                  key={f.key}
                  className={`group cursor-pointer border-border/40 ${color.hover} transition-all duration-200 hover:shadow-md relative overflow-hidden`}
                  onClick={f.onClick}
                >
                  {f.locked && (
                    <div className="absolute top-2 end-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                        {lang === 'ar' ? 'مدفوع' : 'Pro'}
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2.5">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${color.bg} transition-transform group-hover:scale-105 duration-200`}>
                      <Icon className={`h-6 w-6 ${color.icon}`} />
                    </div>
                    <h3 className="font-medium text-sm leading-tight">{f.title}</h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {desc ? desc[lang as 'ar' | 'en'] : ''}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Completed projects */}
        <div>
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">{t('completedProjects')}</h2>
              <Badge variant="outline" className="text-xs">{items.length}</Badge>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'ar' ? 'بحث...' : 'Search...'} className="pl-9 h-9 text-sm" />
            </div>
          </div>

          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin me-2" />
              {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">{search ? (lang === 'ar' ? 'لا توجد نتائج' : 'No results') : t('noProjects')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2.5">
              {filtered.map(item => {
                const TypeIcon = typeIcon(item.type);
                return (
                  <Card key={`${item.type}-${item.id}`} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => openItem(item)}>
                    <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                      <div className="min-w-0 flex-1 flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-muted">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm truncate">{item.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] px-1.5">{typeLabel(item.type)}</Badge>
                            <span className="text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={item.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                          {item.status === 'completed' ? (lang === 'ar' ? 'مكتمل' : 'Done') : item.status}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteItem(item); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
