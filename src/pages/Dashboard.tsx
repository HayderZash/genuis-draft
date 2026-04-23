import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Plus, FileText, Trash2, CheckCircle, FileSpreadsheet, UserCircle,
  BookOpen, Languages, Bot, ShieldCheck, ImageIcon, Search,
  Sparkles, ArrowUpRight, Zap, LayoutGrid, GraduationCap, ClipboardList, RefreshCw
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PointsPanel } from '@/components/PointsPanel';

interface CompletedItem {
  id: string;
  title: string;
  type: 'research' | 'report' | 'cv' | 'thesis';
  status: string;
  created_at: string;
}

const FEATURE_COLORS = [
  { bg: 'from-blue-500/20 to-cyan-500/20', icon: 'text-blue-500', hover: 'group-hover:from-blue-500/30 group-hover:to-cyan-500/30', border: 'hover:border-blue-400/40' },
  { bg: 'from-emerald-500/20 to-green-500/20', icon: 'text-emerald-500', hover: 'group-hover:from-emerald-500/30 group-hover:to-green-500/30', border: 'hover:border-emerald-400/40' },
  { bg: 'from-purple-500/20 to-violet-500/20', icon: 'text-purple-500', hover: 'group-hover:from-purple-500/30 group-hover:to-violet-500/30', border: 'hover:border-purple-400/40' },
  { bg: 'from-orange-500/20 to-amber-500/20', icon: 'text-orange-500', hover: 'group-hover:from-orange-500/30 group-hover:to-amber-500/30', border: 'hover:border-orange-400/40' },
  { bg: 'from-pink-500/20 to-rose-500/20', icon: 'text-pink-500', hover: 'group-hover:from-pink-500/30 group-hover:to-rose-500/30', border: 'hover:border-pink-400/40' },
  { bg: 'from-teal-500/20 to-cyan-500/20', icon: 'text-teal-500', hover: 'group-hover:from-teal-500/30 group-hover:to-cyan-500/30', border: 'hover:border-teal-400/40' },
  { bg: 'from-indigo-500/20 to-blue-500/20', icon: 'text-indigo-500', hover: 'group-hover:from-indigo-500/30 group-hover:to-blue-500/30', border: 'hover:border-indigo-400/40' },
  { bg: 'from-red-500/20 to-orange-500/20', icon: 'text-red-500', hover: 'group-hover:from-red-500/30 group-hover:to-orange-500/30', border: 'hover:border-red-400/40' },
];

const FEATURE_DESCRIPTIONS: Record<string, { ar: string; en: string }> = {
  research: { ar: 'بحوث أكاديمية مع فصول ومراجع وتنسيق كامل بضغطة واحدة', en: 'Full academic research with chapters, references and formatting in one click' },
  proofreading: { ar: 'تدقيق لغوي وكشف نسبة الاستلال في أداة موحدة', en: 'Linguistic proofreading and plagiarism detection in one tool' },
  report: { ar: 'تقارير علمية ومختبرية احترافية جاهزة للطباعة', en: 'Professional scientific and lab reports ready to print' },
  cv: { ar: 'سيرة ذاتية احترافية تناسب سوق العمل الحديث', en: 'Professional CV that fits the modern job market' },
  summarize: { ar: 'تلخيص نصوص طويلة مع الحفاظ على الأفكار الرئيسية', en: 'Summarize long texts while keeping key ideas' },
  translate: { ar: 'ترجمة أكاديمية دقيقة مع مراعاة المصطلحات المتخصصة', en: 'Precise academic translation with specialized terminology' },
  thesis: { ar: 'رسائل ماجستير ودكتوراه بمنهجية بحثية ومصادر معتمدة', en: 'Master & PhD theses with research methodology and verified sources' },
  exam: { ar: 'توليد أسئلة امتحانية أكاديمية متنوعة من أي محتوى', en: 'Generate diverse academic exam questions from any content' },
};

const Dashboard = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [flippedCard, setFlippedCard] = useState<string | null>(null);
  const researchCacheKey = user ? `research_projects_cache_${user.id}` : null;

  const fetchAllItems = async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (researchCacheKey) {
      const cached = localStorage.getItem(researchCacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as ResearchProject[];
          const cachedItems = parsed.map((p: any) => ({ id: p.id, title: p.title || (lang === 'ar' ? 'بحث جديد' : 'New Research'), type: 'research' as const, status: p.status, created_at: p.created_at }));
          setItems(prev => {
            const nonResearch = prev.filter(item => item.type !== 'research');
            return [...cachedItems, ...nonResearch].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          });
          setLoading(false);
        } catch {
          localStorage.removeItem(researchCacheKey);
        }
      }
    }

    // Per-request timeout helper – never let one slow query block the dashboard
    const withTimeout = <T,>(p: PromiseLike<T>, ms = 12000): Promise<T> =>
      Promise.race([
        Promise.resolve(p) as Promise<T>,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]);

    // Use allSettled so one slow/failing table never wipes the others
    const [researchRes, reportsRes, cvsRes, thesesRes] = await Promise.allSettled([
      withTimeout(supabase.from('research_projects').select('id, title, status, created_at').eq('user_id', user.id).order('updated_at', { ascending: false })),
      withTimeout(supabase.from('reports').select('id, title, status, created_at').order('updated_at', { ascending: false })),
      withTimeout(supabase.from('cvs').select('id, full_name, status, created_at').order('updated_at', { ascending: false })),
      withTimeout(supabase.from('theses').select('id, title, status, created_at').order('updated_at', { ascending: false })),
    ]);

    const allItems: CompletedItem[] = [];
    const pick = (res: any) => (res.status === 'fulfilled' ? res.value?.data : null);
    const failures: string[] = [];

    const r = pick(researchRes); if (r) { r.forEach((p: any) => allItems.push({ id: p.id, title: p.title || (lang === 'ar' ? 'بحث جديد' : 'New Research'), type: 'research', status: p.status, created_at: p.created_at })); if (researchCacheKey) localStorage.setItem(researchCacheKey, JSON.stringify(r)); } else if (researchRes.status === 'rejected') failures.push('research');
    const rp = pick(reportsRes); if (rp) rp.forEach((x: any) => allItems.push({ id: x.id, title: x.title || (lang === 'ar' ? 'تقرير جديد' : 'New Report'), type: 'report', status: x.status, created_at: x.created_at })); else if (reportsRes.status === 'rejected') failures.push('reports');
    const cv = pick(cvsRes); if (cv) cv.forEach((c: any) => allItems.push({ id: c.id, title: c.full_name || (lang === 'ar' ? 'سيرة ذاتية' : 'CV'), type: 'cv', status: c.status, created_at: c.created_at })); else if (cvsRes.status === 'rejected') failures.push('cvs');
    const th = pick(thesesRes); if (th) th.forEach((t: any) => allItems.push({ id: t.id, title: t.title || (lang === 'ar' ? 'رسالة جديدة' : 'New Thesis'), type: 'thesis' as any, status: t.status, created_at: t.created_at })); else if (thesesRes.status === 'rejected') failures.push('theses');

    allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setItems(allItems);
    setLoading(false);

    if (failures.length > 0) {
      toast({
        title: lang === 'ar' ? 'تأخّر في تحميل بعض البيانات' : 'Some data took too long to load',
        description: lang === 'ar' ? `يمكنك الضغط على تحديث لإعادة المحاولة (${failures.join(', ')})` : `Press refresh to retry (${failures.join(', ')})`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => { fetchAllItems(); }, [user?.id]);

  const deleteItem = async (item: CompletedItem) => {
    if (item.type === 'research') await supabase.from('research_projects').delete().eq('id', item.id);
    else if (item.type === 'report') await supabase.from('reports').delete().eq('id', item.id);
    else if ((item.type as any) === 'thesis') await supabase.from('theses').delete().eq('id', item.id);
    else await supabase.from('cvs').delete().eq('id', item.id);
    setItems(prev => prev.filter(i => !(i.id === item.id && i.type === item.type)));
  };

  const openItem = (item: CompletedItem) => {
    if (item.type === 'research') navigate(`/project/${item.id}`);
    else if (item.type === 'report') navigate('/reports');
    else if (item.type === 'cv') navigate('/cvs');
  };

  const typeLabel = (type: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      research: { ar: 'بحث أكاديمي', en: 'Research' },
      report: { ar: 'تقرير', en: 'Report' },
      cv: { ar: 'سيرة ذاتية', en: 'CV' },
      thesis: { ar: 'رسالة دراسات عليا', en: 'Thesis' },
    };
    return labels[type]?.[lang] || type;
  };

  const statusVariant = (s: string) => s === 'completed' ? 'default' : s === 'generating' ? 'secondary' : 'outline';

  const features = [
    { key: 'research', icon: FileText, title: lang === 'ar' ? 'البحوث الأكاديمية' : 'Academic Research', onClick: () => navigate('/research') },
    { key: 'thesis', icon: GraduationCap, title: lang === 'ar' ? 'رسائل الدراسات العليا' : 'Graduate Theses', onClick: () => navigate('/theses') },
    { key: 'report', icon: FileSpreadsheet, title: lang === 'ar' ? 'التقارير العلمية' : 'Scientific Reports', onClick: () => navigate('/reports') },
    { key: 'exam', icon: ClipboardList, title: lang === 'ar' ? 'خبير الامتحانات' : 'Exam Expert', onClick: () => navigate('/exam-expert') },
    { key: 'proofreading', icon: ShieldCheck, title: lang === 'ar' ? 'التدقيق والكشف الأكاديمي' : 'Academic Proofreading & Plagiarism', onClick: () => navigate('/proofreading') },
    { key: 'cv', icon: UserCircle, title: lang === 'ar' ? 'السيرة الذاتية' : 'CV Builder', onClick: () => navigate('/cvs') },
    { key: 'summarize', icon: BookOpen, title: lang === 'ar' ? 'تلخيص النصوص' : 'Summarizer', onClick: () => navigate('/summarizer') },
    { key: 'translate', icon: Languages, title: lang === 'ar' ? 'الترجمة الأكاديمية' : 'Translation', onClick: () => navigate('/translator') },
  ];

  const filteredItems = items.filter(item =>
    !search || item.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
        <div className="container mx-auto max-w-6xl px-4 py-10 relative">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {lang === 'ar' ? 'مرحبًا بك في المنصة' : 'Welcome to Platform'}
                </h1>
              </div>
              <p className="text-muted-foreground text-lg max-w-xl">
                {lang === 'ar' ? 'أدواتك الأكاديمية الذكية في مكان واحد — بحوث، تقارير، ترجمة والمزيد.' : 'Your smart academic tools in one place — research, reports, translation & more.'}
              </p>
              {user?.email && (
                <p className="text-xs text-muted-foreground/80 mt-2">
                  {lang === 'ar' ? 'الحساب الحالي: ' : 'Logged in as: '}
                  <span className="font-mono font-medium text-foreground/90">{user.email}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchAllItems} disabled={loading} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                {lang === 'ar' ? 'تحديث' : 'Refresh'}
              </Button>
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
                <Zap className="h-3.5 w-3.5 text-primary" />
                {lang === 'ar' ? `${items.length} مشروع` : `${items.length} projects`}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-10">
        <PointsPanel />

        {/* Feature Cards with flip animation */}
        <div>
          <div className="flex items-center gap-2 mb-5">
            <LayoutGrid className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{lang === 'ar' ? 'الأدوات المتاحة' : 'Available Tools'}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {features.map((f, idx) => {
              const color = FEATURE_COLORS[idx % FEATURE_COLORS.length];
              const isFlipped = flippedCard === f.key;
              const desc = FEATURE_DESCRIPTIONS[f.key];
              return (
                <div
                  key={f.key}
                  className="perspective-1000 cursor-pointer"
                  style={{ perspective: '1000px' }}
                  onMouseEnter={() => setFlippedCard(f.key)}
                  onMouseLeave={() => setFlippedCard(null)}
                  onClick={f.onClick}
                >
                  <div
                    className="relative w-full transition-transform duration-500"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      minHeight: '140px',
                    }}
                  >
                    {/* Front */}
                    <Card
                      className={`absolute inset-0 border-border/40 ${color.border} transition-all duration-300 overflow-hidden`}
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <CardContent className="p-4 flex flex-col items-center text-center gap-3 h-full justify-center">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${color.bg} transition-all duration-300`}>
                          <f.icon className={`h-7 w-7 ${color.icon} transition-transform duration-300`} />
                        </div>
                        <h3 className="font-semibold text-sm leading-tight">{f.title}</h3>
                      </CardContent>
                    </Card>
                    {/* Back */}
                    <Card
                      className={`absolute inset-0 border-border/40 ${color.border} bg-gradient-to-br ${color.bg} overflow-hidden`}
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <CardContent className="p-4 flex flex-col items-center text-center gap-2 h-full justify-center">
                        <f.icon className={`h-6 w-6 ${color.icon} mb-1`} />
                        <p className="text-xs font-medium leading-relaxed">
                          {desc ? desc[lang as 'ar' | 'en'] : f.title}
                        </p>
                        <ArrowUpRight className={`h-4 w-4 ${color.icon} mt-1`} />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Projects Section */}
        <div>
          <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">{t('completedProjects')}</h2>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'ar' ? 'بحث في المشاريع...' : 'Search projects...'}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-12">...</div>
          ) : filteredItems.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-16 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium text-lg">{search ? (lang === 'ar' ? 'لا توجد نتائج' : 'No results') : t('noProjects')}</p>
                <p className="text-sm mt-1 opacity-70">{lang === 'ar' ? 'ابدأ بإنشاء مشروع جديد من الأدوات أعلاه' : 'Start by creating a new project from the tools above'}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2.5">
              {filteredItems.map(item => (
                <Card key={`${item.type}-${item.id}`} className="group cursor-pointer hover:shadow-md hover:border-primary/20 transition-all border-border/40" onClick={() => openItem(item)}>
                  <CardHeader className="flex flex-row items-center justify-between py-3.5 px-5">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{item.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {typeLabel(item.type)} • {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Badge variant={statusVariant(item.status)} className="text-xs">
                        {t(item.status as any)}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); deleteItem(item); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
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
