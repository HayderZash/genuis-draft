import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, FileText, Trash2 } from 'lucide-react';
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
  const { checkAndConsume } = useFeatureAccess();
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const cacheKey = user ? `research_projects_cache_${user.id}` : null;

  const fetchProjects = async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (cacheKey) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          setProjects(JSON.parse(cached));
          setLoading(false);
        } catch {
          localStorage.removeItem(cacheKey);
        }
      }
    }

    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 12000);
      const result = await supabase
        .from('research_projects')
        .select('id, title, status, created_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .abortSignal(controller.signal);
      window.clearTimeout(timer);

      if (result?.data) {
        setProjects(result.data);
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(result.data));
      }
      else if (result?.error) {
        toast({ title: result.error.message, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({
        title: lang === 'ar' ? 'تأخّر تحميل البحوث - حاول التحديث' : 'Loading research timed out - press refresh',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, [user?.id]);

  const createProject = async () => {
    if (!user || creating) return;
    setCreating(true);
    const allowed = await checkAndConsume('research', lang);
    if (!allowed) {
      setCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from('research_projects')
      .insert({ user_id: user!.id, title: '', chapter_count: 5, chapters: getDefaultChapters(5) })
      .select('id')
      .single();

    if (error) {
      setCreating(false);
      toast({ title: error.message, variant: 'destructive' });
      return;
    }

    const nextProjects = [{ id: data.id, title: '', status: 'draft', created_at: new Date().toISOString() }, ...projects];
    setProjects(nextProjects);
    if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(nextProjects));
    setCreating(false);
    navigate(`/project/${data.id}`);
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
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
      </Button>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('myResearch')}</h2>
        <Button onClick={createProject} className="gap-2" disabled={creating}>
          <Plus className="h-4 w-4" /> {t('newResearch')}
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">...</div>
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
  );
};

export default ResearchList;
