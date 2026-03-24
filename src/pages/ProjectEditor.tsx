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
import { generateResearch, regenerateChapter } from '@/lib/ai-generation';
import { exportToDocx } from '@/lib/export-docx';
import type { AIProvider } from '@/components/SettingsDialog';
import { PROVIDER_KEY_MAP, getMergeConfig, getProviderKey } from '@/components/SettingsDialog';
import { ArrowLeft, PanelLeftClose, PanelLeft, Download, Settings2 } from 'lucide-react';
import { ContentQualityIndicator } from '@/components/project/ContentQualityIndicator';

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
  chapter_pages: number[];
  text_direction: string;
  reference_count: number;
  include_toc: boolean;
  include_list_of_tables: boolean;
  include_list_of_figures: boolean;
  include_images: boolean;
  include_data_tables: boolean;
  image_quality: string;
  project_type: string;
  include_abbreviations: boolean;
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
  const [generationState, setGenerationState] = useState<{ active: boolean; step: string; progress: number; phase: 'text' | 'images' }>({
    active: false, step: '', progress: 0, phase: 'text',
  });
  const [regeneratingIndex, setRegeneratingIndex] = useState<number>(-1);

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
      chapter_pages: (data.chapter_pages as any) || [],
      text_direction: data.text_direction || 'rtl',
      reference_count: data.reference_count || 10,
      include_toc: (data as any).include_toc ?? true,
      include_list_of_tables: (data as any).include_list_of_tables ?? false,
      include_list_of_figures: (data as any).include_list_of_figures ?? false,
      include_images: data.include_images ?? false,
      include_data_tables: data.include_data_tables ?? false,
      image_quality: (data as any).image_quality || 'standard',
      project_type: (data as any).project_type || 'research',
      include_abbreviations: (data as any).include_abbreviations ?? false,
    });
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const saveProject = useCallback(async (updates: Partial<ProjectData>) => {
    if (!project) return;
    const newProject = { ...project, ...updates };
    setProject(newProject);
    const { chapters, content, chapter_pages, ...rest } = updates;
    const dbUpdates: any = { ...rest };
    if (chapters !== undefined) dbUpdates.chapters = chapters;
    if (content !== undefined) dbUpdates.content = content;
    if (chapter_pages !== undefined) dbUpdates.chapter_pages = chapter_pages;
    await supabase.from('research_projects').update(dbUpdates).eq('id', project.id);
  }, [project]);

  const handleGenerate = async () => {
    if (!project) return;
    const mergeConfig = getMergeConfig();
    const provider = (localStorage.getItem('ai_provider') as AIProvider) || 'lovable' as AIProvider;
    const apiKey = getProviderKey(provider);
    setGenerationState({ active: true, step: t('analyzingTopic'), progress: 5, phase: 'text' });
    try {
      const content = await generateResearch({
        apiKey,
        provider,
        project,
        lang: project.research_language as 'ar' | 'en',
        onProgress: (step, progress) => setGenerationState({ active: true, step, progress, phase: 'text' }),
        t,
      });
      await saveProject({ content, status: 'completed' });
      setGenerationState({ active: false, step: '', progress: 100, phase: 'text' });
      toast({ title: lang === 'ar' ? 'تم توليد البحث بنجاح!' : 'Research generated successfully!' });

      // Phase 2: Image Generation - scan for figure captions
      const figureRegex = /\[Figure\s+([\d.]+):\s*([^\]]+)\]/gi;
      const allText = Object.values(content).join('\n');
      const matches = [...allText.matchAll(figureRegex)];
      
      console.log('[ImageGen] Found figure captions:', matches.length);
      matches.forEach((m, i) => console.log(`[ImageGen] Caption ${i + 1}: ${m[0]}`));

      if (matches.length > 0) {
        const isAr = project.research_language === 'ar';
        setGenerationState({ active: true, step: isAr ? `🎨 بدء توليد ${matches.length} صورة...` : `🎨 Starting generation of ${matches.length} images...`, progress: 0, phase: 'images' });

        const updatedContent = { ...content };
        delete updatedContent._full;
        let successCount = 0;
        
        // Build a map of which chapter each figure belongs to for unique context
        const figureChapterMap = new Map<string, string>();
        for (const key of Object.keys(content)) {
          const chapterMatches = [...(content[key] || '').matchAll(/\[Figure\s+([\d.]+):\s*([^\]]+)\]/gi)];
          for (const cm of chapterMatches) {
            figureChapterMap.set(cm[0], key);
          }
        }
        
        // Track generated URLs to prevent duplicates
        const generatedUrls = new Set<string>();
        
        for (let m = 0; m < matches.length; m++) {
          const match = matches[m];
          const description = match[2].trim();
          const figureNumber = match[1];
          const progress = ((m + 1) / matches.length) * 100;
          setGenerationState({ active: true, step: isAr ? `🎨 توليد صورة (${m + 1}/${matches.length}): ${description.substring(0, 50)}...` : `🎨 (${m + 1}/${matches.length}) ${description.substring(0, 50)}...`, progress, phase: 'images' });

          // Build unique context: project title + chapter name + figure number
          const chapterKey = figureChapterMap.get(match[0]) || '';
          const chapterIdx = chapterKey.startsWith('chapter_') ? parseInt(chapterKey.replace('chapter_', '')) : -1;
          const chapterName = chapterIdx >= 0 && project.chapters[chapterIdx] 
            ? (project.research_language === 'ar' ? project.chapters[chapterIdx].nameAr : project.chapters[chapterIdx].name)
            : '';
          const uniqueContext = `${project.title} - ${chapterName} - Figure ${figureNumber}`.trim();

          try {
            console.log(`[ImageGen] Generating image ${m + 1}/${matches.length}: ${description} (context: ${uniqueContext})`);
            const geminiKey = localStorage.getItem('gemini_api_key') || '';
            const { data, error } = await supabase.functions.invoke('generate-image', { body: { prompt: description, context: uniqueContext, model: project.image_quality === 'high' ? 'pro' : 'standard', geminiApiKey: geminiKey } });
            
            if (error) {
              console.error(`[ImageGen] Edge function error for "${description}":`, error);
              continue;
            }
            
            if (data?.imageUrl) {
              // Skip if we got a duplicate URL (same image returned twice)
              if (generatedUrls.has(data.imageUrl)) {
                console.warn(`[ImageGen] Duplicate image URL detected for "${description}", retrying...`);
                // Retry once with slightly modified prompt
                const retryResult = await supabase.functions.invoke('generate-image', { body: { prompt: `${description} - unique view ${m + 1}`, context: uniqueContext, model: project.image_quality === 'high' ? 'pro' : 'standard', geminiApiKey: geminiKey } });
                if (retryResult.data?.imageUrl && !generatedUrls.has(retryResult.data.imageUrl)) {
                  data.imageUrl = retryResult.data.imageUrl;
                }
              }
              generatedUrls.add(data.imageUrl);
              console.log(`[ImageGen] Success! URL: ${data.imageUrl.substring(0, 80)}...`);
              const imgHtml = `<img src="${data.imageUrl}" alt="${description}" style="max-width:80%;display:block;margin:12px auto;border-radius:8px;" />`;
              // Find and replace the caption text, inserting image before it
              for (const key of Object.keys(updatedContent)) {
                if (updatedContent[key].includes(match[0])) {
                  // Find the <p> tag containing this figure caption and insert image before it
                  const captionParagraphRegex = new RegExp(
                    `(<p[^>]*>\\s*\\[Figure\\s+${match[1].replace('.', '\\.')}:[^\\]]+\\]\\s*</p>)`,
                    'i'
                  );
                  const pMatch = updatedContent[key].match(captionParagraphRegex);
                  if (pMatch) {
                    updatedContent[key] = updatedContent[key].replace(pMatch[0], imgHtml + pMatch[0]);
                  } else {
                    // Fallback: insert before the raw text
                    updatedContent[key] = updatedContent[key].replace(match[0], imgHtml + match[0]);
                  }
                  break;
                }
              }
              successCount++;
            } else {
              console.error(`[ImageGen] No imageUrl in response for "${description}":`, JSON.stringify(data).substring(0, 200));
            }
          } catch (e) {
            console.error('[ImageGen] Failed:', description, e);
            // Insert upload placeholder on failure
            const placeholderHtml = `<div style="border:2px dashed #999;border-radius:8px;padding:20px;text-align:center;margin:12px auto;max-width:80%;background:#f9f9f9;cursor:pointer;" class="image-upload-placeholder" data-figure="${figureNumber}" data-description="${description.replace(/"/g, '&quot;')}">
              <p style="margin:0;color:#666;font-size:13px;">⚠️ ${isAr ? 'فشل توليد الصورة تلقائياً' : 'Auto-generation failed'}</p>
              <p style="margin:4px 0 0;color:#999;font-size:12px;">${isAr ? 'استخدم زر رفع الصورة 📷 في شريط الأدوات لإدراج صورة يدوياً' : 'Use the 📷 upload button in the toolbar to insert an image manually'}</p>
            </div>`;
            for (const key of Object.keys(updatedContent)) {
              if (updatedContent[key].includes(match[0])) {
                const captionParagraphRegex = new RegExp(
                  `(<p[^>]*>\\s*\\[Figure\\s+${match[1].replace('.', '\\.')}:[^\\]]+\\]\\s*</p>)`,
                  'i'
                );
                const pMatch = updatedContent[key].match(captionParagraphRegex);
                if (pMatch) {
                  updatedContent[key] = updatedContent[key].replace(pMatch[0], placeholderHtml + pMatch[0]);
                } else {
                  updatedContent[key] = updatedContent[key].replace(match[0], placeholderHtml + match[0]);
                }
                break;
              }
            }
          }

          // Small delay between image generations
          if (m < matches.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }

        if (successCount > 0) {
          delete updatedContent._full;
          await saveProject({ content: updatedContent });
          toast({ title: isAr ? `تم توليد ${successCount} من ${matches.length} صورة بنجاح!` : `${successCount} of ${matches.length} images generated successfully!` });
        } else {
          toast({ title: isAr ? 'لم يتم توليد أي صور' : 'No images were generated', variant: 'destructive' });
        }
      }

      setGenerationState({ active: false, step: '', progress: 100, phase: 'text' });
    } catch (err: any) {
      setGenerationState({ active: false, step: '', progress: 0, phase: 'text' });
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  const handleRegenerateChapter = async (chapterIndex: number) => {
    if (!project) return;
    const provider = (localStorage.getItem('ai_provider') as AIProvider) || 'lovable' as AIProvider;
    const apiKey = getProviderKey(provider);
    setRegeneratingIndex(chapterIndex);
    setGenerationState({ active: true, step: t('regeneratingChapter'), progress: 10, phase: 'text' });
    try {
      const chapterContent = await regenerateChapter({
        apiKey, provider, project,
        lang: project.research_language as 'ar' | 'en',
        chapterIndex,
        onProgress: (step, progress) => setGenerationState({ active: true, step, progress, phase: 'text' }),
        t,
      });
      const newContent = { ...project.content, [`chapter_${chapterIndex}`]: chapterContent };
      delete newContent._full;
      await saveProject({ content: newContent });
      setGenerationState({ active: false, step: '', progress: 100, phase: 'text' });
      toast({ title: lang === 'ar' ? 'تم إعادة توليد الفصل بنجاح!' : 'Chapter regenerated successfully!' });
    } catch (err: any) {
      setGenerationState({ active: false, step: '', progress: 0, phase: 'text' });
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setRegeneratingIndex(-1);
    }
  };

  const handleExport = async () => {
    if (!project) return;
    toast({ title: lang === 'ar' ? 'جاري تحضير الملف...' : 'Preparing file...' });
    await exportToDocx(project, lang);
  };

  if (loading || !project) return <div className="flex items-center justify-center min-h-screen">...</div>;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-80 shrink-0 border-e overflow-y-auto bg-muted/30 p-4">
          <ProjectSidebar project={project} onUpdate={saveProject} onGenerate={handleGenerate} generating={generationState.active} onRegenerateChapter={handleRegenerateChapter} regeneratingIndex={regeneratingIndex} />
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
          <GenerationProgress step={generationState.step} progress={generationState.progress} phase={generationState.phase} />
        )}

        {/* Quality Indicator */}
        {!generationState.active && project.status === 'completed' && (
          <ContentQualityIndicator project={project} />
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
