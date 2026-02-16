import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { ProjectSidebar } from '@/components/project/ProjectSidebar';
import { ResearchEditor } from '@/components/project/ResearchEditor';
import { GenerationProgress } from '@/components/project/GenerationProgress';
import { PageSettingsPanel } from '@/components/project/PageSettingsPanel';
import { generateResearch } from '@/lib/ai-generation';
import { exportToDocx } from '@/lib/export-docx';
import { ArrowLeft, PanelLeftClose, PanelLeft, Download, Settings2 } from 'lucide-react';

export interface ProjectData {
  id: string;
  title: string;
  abstract: string;
  research_language: string;
  custom_references: string;
  chapter_count: number;
  chapters: { name: string; nameAr: string }[];
  content: Record<string, string>;
  status: string;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
}

const ProjectEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [generationState, setGenerationState] = useState<{ active: boolean; step: string; progress: number }>({
    active: false, step: '', progress: 0,
  });

  const fetchProject = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('research_projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) {
      toast({ title: 'Project not found', variant: 'destructive' });
      navigate('/');
      return;
    }
    setProject({
      ...data,
      chapters: (data.chapters as any) || [],
      content: (data.content as any) || {},
    });
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const saveProject = useCallback(async (updates: Partial<ProjectData>) => {
    if (!project) return;
    const newProject = { ...project, ...updates };
    setProject(newProject);
    const { chapters, content, ...rest } = updates;
    const dbUpdates: any = { ...rest };
    if (chapters !== undefined) dbUpdates.chapters = chapters;
    if (content !== undefined) dbUpdates.content = content;
    await supabase.from('research_projects').update(dbUpdates).eq('id', project.id);
  }, [project]);

  const handleGenerate = async () => {
    if (!project) return;
    const provider = (localStorage.getItem('ai_provider') as 'openai' | 'gemini') || 'openai';
    const apiKey = provider === 'gemini'
      ? localStorage.getItem('gemini_api_key')
      : localStorage.getItem('openai_api_key');
    if (!apiKey) {
      toast({ title: t('apiKeyRequired'), variant: 'destructive' });
      return;
    }
    setGenerationState({ active: true, step: t('analyzingTopic'), progress: 5 });
    try {
      const content = await generateResearch({
        apiKey,
        provider,
        project,
        lang: project.research_language as 'ar' | 'en',
        onProgress: (step, progress) => setGenerationState({ active: true, step, progress }),
        t,
      });
      await saveProject({ content, status: 'completed' });
      setGenerationState({ active: false, step: '', progress: 100 });
      toast({ title: lang === 'ar' ? 'تم توليد البحث بنجاح!' : 'Research generated successfully!' });
    } catch (err: any) {
      setGenerationState({ active: false, step: '', progress: 0 });
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  const handleExport = () => {
    if (!project) return;
    exportToDocx(project, lang);
  };

  if (loading || !project) return <div className="flex items-center justify-center min-h-screen">...</div>;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-80 shrink-0 border-e overflow-y-auto bg-muted/30 p-4">
          <ProjectSidebar project={project} onUpdate={saveProject} onGenerate={handleGenerate} generating={generationState.active} />
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2 bg-background">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setPageSettingsOpen(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handleExport} className="gap-1" disabled={Object.keys(project.content).length === 0}>
              <Download className="h-4 w-4" /> {t('downloadWord')}
            </Button>
          </div>
        </div>

        {/* Generation Progress */}
        {generationState.active && (
          <GenerationProgress step={generationState.step} progress={generationState.progress} />
        )}

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          <ResearchEditor project={project} onContentChange={(content) => saveProject({ content })} />
        </div>
      </div>

      <PageSettingsPanel open={pageSettingsOpen} onOpenChange={setPageSettingsOpen} project={project} onUpdate={saveProject} />
    </div>
  );
};

export default ProjectEditor;
