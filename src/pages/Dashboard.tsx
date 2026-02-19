import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Trash2, CheckCircle, FileSpreadsheet, UserCircle, BookOpen, Languages, Bot, ShieldCheck, ImageIcon, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PointsPanel } from '@/components/PointsPanel';

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
  const [search, setSearch] = useState('');

  const fetchAllItems = async () => {
    const [researchRes, reportsRes, cvsRes] = await Promise.all([
      supabase.from('research_projects').select('id, title, status, created_at').order('updated_at', { ascending: false }),
      supabase.from('reports').select('id, title, status, created_at').order('updated_at', { ascending: false }),
      supabase.from('cvs').select('id, full_name, status, created_at').order('updated_at', { ascending: false }),
    ]);

    const allItems: CompletedItem[] = [];
    if (researchRes.data) researchRes.data.forEach(p => allItems.push({ id: p.id, title: p.title || (lang === 'ar' ? 'بحث جديد' : 'New Research'), type: 'research', status: p.status, created_at: p.created_at }));
    if (reportsRes.data) reportsRes.data.forEach(r => allItems.push({ id: r.id, title: r.title || (lang === 'ar' ? 'تقرير جديد' : 'New Report'), type: 'report', status: r.status, created_at: r.created_at }));
    if (cvsRes.data) cvsRes.data.forEach(c => allItems.push({ id: c.id, title: c.full_name || (lang === 'ar' ? 'سيرة ذاتية' : 'CV'), type: 'cv', status: c.status, created_at: c.created_at }));

    allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setItems(allItems);
    setLoading(false);
  };

  useEffect(() => { fetchAllItems(); }, []);

  const deleteItem = async (item: CompletedItem) => {
    if (item.type === 'research') await supabase.from('research_projects').delete().eq('id', item.id);
    else if (item.type === 'report') await supabase.from('reports').delete().eq('id', item.id);
    else await supabase.from('cvs').delete().eq('id', item.id);
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
    { key: 'research', icon: FileText, title: lang === 'ar' ? 'البحوث الأكاديمية' : 'Academic Research', desc: lang === 'ar' ? 'إنشاء بحوث تخرج كاملة' : 'Create full graduation research', gradient: 'from-blue-500/10 to-blue-600/5', iconColor: 'text-blue-600', onClick: () => navigate('/research') },
    { key: 'proofreading', icon: CheckCircle, title: lang === 'ar' ? 'التدقيق اللغوي' : 'Proofreading', desc: lang === 'ar' ? 'تدقيق نصوص أكاديمية' : 'Academic text proofreading', gradient: 'from-emerald-500/10 to-emerald-600/5', iconColor: 'text-emerald-600', onClick: () => navigate('/proofreading') },
    { key: 'report', icon: FileSpreadsheet, title: lang === 'ar' ? 'التقارير العلمية' : 'Scientific Reports', desc: lang === 'ar' ? 'إنشاء تقارير احترافية' : 'Create professional reports', gradient: 'from-amber-500/10 to-amber-600/5', iconColor: 'text-amber-600', onClick: () => navigate('/reports') },
    { key: 'cv', icon: UserCircle, title: lang === 'ar' ? 'السيرة الذاتية' : 'CV Builder', desc: lang === 'ar' ? 'سيرة ذاتية احترافية' : 'Professional CV', gradient: 'from-violet-500/10 to-violet-600/5', iconColor: 'text-violet-600', onClick: () => navigate('/cvs') },
    { key: 'summarize', icon: BookOpen, title: lang === 'ar' ? 'تلخيص النصوص' : 'Summarizer', desc: lang === 'ar' ? 'تلخيص نصوص طويلة' : 'Summarize long texts', gradient: 'from-cyan-500/10 to-cyan-600/5', iconColor: 'text-cyan-600', onClick: () => navigate('/summarizer') },
    { key: 'translate', icon: Languages, title: lang === 'ar' ? 'الترجمة الأكاديمية' : 'Translation', desc: lang === 'ar' ? 'ترجمة أكاديمية دقيقة' : 'Precise academic translation', gradient: 'from-rose-500/10 to-rose-600/5', iconColor: 'text-rose-600', onClick: () => navigate('/translator') },
    { key: 'image-gen', icon: ImageIcon, title: lang === 'ar' ? 'مولد الصور' : 'Image Generator', desc: lang === 'ar' ? 'صور احترافية بالذكاء الاصطناعي' : 'AI professional images', gradient: 'from-orange-500/10 to-orange-600/5', iconColor: 'text-orange-600', onClick: () => navigate('/image-generator') },
    { key: 'plagiarism', icon: ShieldCheck, title: lang === 'ar' ? 'كشف نسبة الاستلال' : 'Plagiarism Detection', desc: lang === 'ar' ? 'فحص نسبة الاستلال' : 'Check plagiarism percentage', gradient: 'from-teal-500/10 to-teal-600/5', iconColor: 'text-teal-600', onClick: () => navigate('/plagiarism') },
  ];

  const filteredItems = items.filter(item =>
    !search || item.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <PointsPanel />

      {/* Feature Cards - Redesigned */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
        {features.map(f => (
          <Card
            key={f.key}
            className="group cursor-pointer border border-border/50 hover:border-primary/40 hover:shadow-xl transition-all duration-300 overflow-hidden"
            onClick={f.onClick}
          >
            <CardContent className="p-5 text-center relative">
              <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative z-10">
                <div className="inline-flex p-3 rounded-2xl bg-muted group-hover:bg-background/80 transition-colors mb-3">
                  <f.icon className={`h-7 w-7 ${f.iconColor} transition-transform group-hover:scale-110`} />
                </div>
                <h3 className="font-bold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Projects */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h2 className="text-2xl font-bold">{t('completedProjects')}</h2>
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
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">{search ? (lang === 'ar' ? 'لا توجد نتائج' : 'No results') : t('noProjects')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map(item => (
            <Card key={`${item.type}-${item.id}`} className="group cursor-pointer hover:shadow-md hover:border-primary/20 transition-all" onClick={() => openItem(item)}>
              <CardHeader className="flex flex-row items-center justify-between py-4 px-5">
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
