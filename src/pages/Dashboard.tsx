import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Project {
  id: string;
  title: string;
  status: string;
  created_at: string;
  research_language: string;
}

const Dashboard = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('research_projects')
      .select('id, title, status, created_at, research_language')
      .order('updated_at', { ascending: false });
    if (!error && data) setProjects(data);
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const createProject = async () => {
    const { data, error } = await supabase
      .from('research_projects')
      .insert({ user_id: user!.id, title: '', chapter_count: 5, chapters: getDefaultChapters(5) })
      .select('id')
      .single();
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }
    navigate(`/project/${data.id}`);
  };

  const deleteProject = async (id: string) => {
    await supabase.from('research_projects').delete().eq('id', id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const statusVariant = (s: string) => s === 'completed' ? 'default' : s === 'generating' ? 'secondary' : 'outline';

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold">{t('myProjects')}</h2>
        <Button onClick={createProject} className="gap-2">
          <Plus className="h-4 w-4" /> {t('newProject')}
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">...</div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>{t('noProjects')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map(p => (
            <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/project/${p.id}`)}>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-lg">{p.title || t('newProject')}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(p.status)}>
                    {t(p.status as any)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
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
