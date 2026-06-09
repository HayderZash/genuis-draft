import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, FileText, Trash2, Loader as Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getDefaultChapters } from '@/pages/Dashboard';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

interface ResearchProject {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

const ResearchList = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { checkAndConsume } = useFeatureAccess();
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const cacheKey = user ? `research_projects_cache_${user.id}` : null;

  const fetchProjects = async () => {
    if (!user) { setProjects([]); setLoading(false); return; }

    // Show cache immediately
    if (cacheKey) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length) {
            setProjects(parsed);
            setLoading(false);
          }
        } catch {}
      }
    }

    // Plain query — no AbortController. If it's slow, we just keep cached state.
    try {
      const { data } = await supabase
        .from('research_projects')
        .select('id, title, status, created_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (Array.isArray(data)) {
        setProjects(data);
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(data));
      }
    } catch {
      // Silent — cache still shown, user can press Refresh
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); /* eslint-disable-next-line */ }, [user?.id]);

  useEffect(() => {
    if (searchParams.get('create') === '1' && user && !creating) {
      setSearchParams({}, { replace: true });
      createProject();
    }
  }, [searchParams, user]);

  const createProject = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      // Access check is best-effort; never let it block on DB hiccups
      const checkPromise = checkAndConsume('research', lang);
      const allowed = await Promise.race<boolean>([
        checkPromise,
        new Promise<boolean>(res => setTimeout(() => res(true), 3500)),
      ]);
      if (!allowed) return;

      // Insert with retries to survive transient 504s
      const tryInsert = async () => supabase
        .from('research_projects')
        .insert({ user_id: user.id, title: '', chapter_count: 5, chapters: getDefaultChapters(5) })
        .select('id')
        .single();

      let lastErr: any = null;
      let data: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await tryInsert();
        if (!res.error && res.data?.id) { data = res.data; lastErr = null; break; }
        lastErr = res.error;
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
      }

      if (!data) {
        toast({
          title: lang === 'ar'
            ? 'الخادم بطيء حالياً، يرجى المحاولة بعد لحظات'
            : 'Server is slow right now, please try again',
          description: lastErr?.message || undefined,
          variant: 'destructive',
        });
        return;
      }

      const next = [{ id: data.id, title: '', status: 'draft', created_at: new Date().toISOString() }, ...projects];
      setProjects(next);
      if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
      navigate(`/project/${data.id}`);
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (id: string) => {
    await supabase.from('research_projects').delete().eq('id', id);
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id);
      if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/5" />
        <div className="container mx-auto max-w-4xl px-4 py-6 relative">
          <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-3 -ms-2">
            <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
          </Button>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10"><FileText className="h-6 w-6 text-blue-600" /></div>
              <div>
                <h2 className="text-2xl font-bold">{t('myResearch')}</h2>
                <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'البحوث الأكاديمية الخاصة بك' : 'Your academic research projects'}</p>
              </div>
            </div>
            <Button onClick={createProject} className="gap-2" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t('newResearch')}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-6">

      {loading && projects.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>{t('noResearch')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map(p => (
            <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/project/${p.id}`)}>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-lg">{p.title || (lang === 'ar' ? 'بحث جديد' : 'New Research')}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === 'completed' ? 'default' : p.status === 'generating' ? 'secondary' : 'outline'}>
                    {t(p.status as any)}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}>
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
  );
};

export default ResearchList;
