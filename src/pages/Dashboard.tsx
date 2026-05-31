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
import { PointsPanel } from '@/components/PointsPanel';

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
  { bg: 'from-blue-500/20 to-cyan-500/20', icon: 'text-blue-500', hover: '', border: 'hover:border-blue-400/40' },
  { bg: 'from-emerald-500/20 to-green-500/20', icon: 'text-emerald-500', hover: '', border: 'hover:border-emerald-400/40' },
  { bg: 'from-purple-500/20 to-violet-500/20', icon: 'text-purple-500', hover: '', border: 'hover:border-purple-400/40' },
  { bg: 'from-orange-500/20 to-amber-500/20', icon: 'text-orange-500', hover: '', border: 'hover:border-orange-400/40' },
  { bg: 'from-pink-500/20 to-rose-500/20', icon: 'text-pink-500', hover: '', border: 'hover:border-pink-400/40' },
  { bg: 'from-teal-500/20 to-cyan-500/20', icon: 'text-teal-500', hover: '', border: 'hover:border-teal-400/40' },
  { bg: 'from-indigo-500/20 to-blue-500/20', icon: 'text-indigo-500', hover: '', border: 'hover:border-indigo-400/40' },
  { bg: 'from-red-500/20 to-orange-500/20', icon: 'text-red-500', hover: '', border: 'hover:border-red-400/40' },
];

const FEATURE_DESCRIPTIONS: Record<string, { ar: string; en: string }> = {
  research: { ar: 'بحوث أكاديمية مع فصول ومراجع وتنسيق كامل', en: 'Full academic research with chapters and references' },
  proofreading: { ar: 'تدقيق لغوي وكشف نسبة الاستلال', en: 'Linguistic proofreading and plagiarism detection' },
  report: { ar: 'تقارير علمية ومختبرية احترافية', en: 'Professional scientific and lab reports' },
  cv: { ar: 'سيرة ذاتية احترافية متوافقة مع ATS', en: 'Professional ATS-compatible CV' },
  summarize: { ar: 'تلخيص النصوص الطويلة بذكاء', en: 'Smart summarization of long texts' },
  translate: { ar: 'ترجمة أكاديمية دقيقة', en: 'Precise academic translation' },
  thesis: { ar: 'رسائل ماجستير ودكتوراه بمنهجية معتمدة', en: 'Master & PhD theses with verified methodology' },
  exam: { ar: 'توليد أسئلة امتحانية من أي محتوى', en: 'Generate exam questions from any content' },
};

// Safe query helper: never throws, returns null on failure/timeout
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
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve([]);
    });
  });
};

const Dashboard = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [flippedCard, setFlippedCard] = useState<string | null>(null);
  const cacheKey = user ? `dashboard_items_cache_${user.id}` : null;

  const fetchAllItems = async () => {
    if (!user) { setItems([]); setLoading(false); return; }

    setLoading(true);

    // Show cached items immediately
    if (cacheKey) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CompletedItem[];
          if (Array.isArray(parsed) && parsed.length) {
            setItems(parsed);
            setLoading(false);
          }
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

  useEffect(() => { fetchAllItems(); /* eslint-disable-next-line */ }, [user?.id]);

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

  const features = [
    { key: 'research', icon: FileText, title: lang === 'ar' ? 'البحوث الأكاديمية' : 'Academic Research', onClick: () => navigate('/research') },
    { key: 'thesis', icon: GraduationCap, title: lang === 'ar' ? 'رسائل الدراسات العليا' : 'Graduate Theses', onClick: () => navigate('/theses') },
    { key: 'report', icon: FileSpreadsheet, title: lang === 'ar' ? 'التقارير العلمية' : 'Scientific Reports', onClick: () => navigate('/reports') },
    { key: 'exam', icon: ClipboardList, title: lang === 'ar' ? 'خبير الامتحانات' : 'Exam Expert', onClick: () => navigate('/exam-expert') },
    { key: 'proofreading', icon: ShieldCheck, title: lang === 'ar' ? 'التدقيق والكشف الأكاديمي' : 'Academic Proofreading', onClick: () => navigate('/proofreading') },
    { key: 'cv', icon: UserCircle, title: lang === 'ar' ? 'السيرة الذاتية' : 'CV Builder', onClick: () => navigate('/cvs') },
    { key: 'summarize', icon: BookOpen, title: lang === 'ar' ? 'تلخيص النصوص' : 'Summarizer', onClick: () => navigate('/summarizer') },
    { key: 'translate', icon: Languages, title: lang === 'ar' ? 'الترجمة الأكاديمية' : 'Translation', onClick: () => navigate('/translator') },
  ];

  const filtered = items.filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
        <div className="container mx-auto max-w-6xl px-4 py-10 relative">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-primary/10"><Sparkles className="h-6 w-6 text-primary" /></div>
                <h1 className="text-3xl font-bold tracking-tight">{lang === 'ar' ? 'مرحبًا بك في المنصة' : 'Welcome to Platform'}</h1>
              </div>
              <p className="text-muted-foreground text-lg max-w-xl">
                {lang === 'ar' ? 'أدواتك الأكاديمية الذكية في مكان واحد — بحوث، تقارير، ترجمة والمزيد.' : 'Your smart academic tools in one place.'}
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
                  className="cursor-pointer"
                  style={{ perspective: '1000px' }}
                  onMouseEnter={() => setFlippedCard(f.key)}
                  onMouseLeave={() => setFlippedCard(null)}
                  onClick={f.onClick}
                >
                  <div className="relative w-full transition-transform duration-500" style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', minHeight: '140px' }}>
                    <Card className={`absolute inset-0 border-border/40 ${color.border} transition-all duration-300 overflow-hidden`} style={{ backfaceVisibility: 'hidden' }}>
                      <CardContent className="p-4 flex flex-col items-center text-center gap-3 h-full justify-center">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${color.bg}`}>
                          <f.icon className={`h-7 w-7 ${color.icon}`} />
                        </div>
                        <h3 className="font-semibold text-sm leading-tight">{f.title}</h3>
                      </CardContent>
                    </Card>
                    <Card className={`absolute inset-0 border-border/40 ${color.border} bg-gradient-to-br ${color.bg} overflow-hidden`} style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      <CardContent className="p-4 flex flex-col items-center text-center gap-2 h-full justify-center">
                        <f.icon className={`h-6 w-6 ${color.icon} mb-1`} />
                        <p className="text-xs font-medium leading-relaxed">{desc ? desc[lang as 'ar' | 'en'] : f.title}</p>
                        <ArrowUpRight className={`h-4 w-4 ${color.icon} mt-1`} />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">{t('completedProjects')}</h2>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'ar' ? 'بحث في المشاريع...' : 'Search projects...'} className="pl-9" />
            </div>
          </div>

          {loading && items.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-16 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium text-lg">{search ? (lang === 'ar' ? 'لا توجد نتائج' : 'No results') : t('noProjects')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map(item => (
                <Card key={`${item.type}-${item.id}`} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openItem(item)}>
                  <CardHeader className="flex flex-row items-center justify-between py-4">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{item.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{typeLabel(item.type)}</Badge>
                        <Badge variant={item.status === 'completed' ? 'default' : 'secondary'} className="text-xs">{item.status}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteItem(item); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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

export default Dashboard;
