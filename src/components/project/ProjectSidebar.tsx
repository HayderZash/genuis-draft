import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChapterList } from './ChapterList';
import { Loader as Loader2, Sparkles } from 'lucide-react';
import { getDefaultChapters } from '@/pages/Dashboard';
import { useUserPlan } from '@/hooks/useUserPlan';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { toast } from '@/hooks/use-toast';
import type { ProjectData } from '@/pages/ProjectEditor';

interface Props {
  project: ProjectData;
  onUpdate: (updates: Partial<ProjectData>) => void;
  onGenerate: () => void;
  generating: boolean;
  onRegenerateChapter?: (index: number) => void;
  regeneratingIndex?: number;
}

export const ProjectSidebar = ({ project, onUpdate, onGenerate, generating, onRegenerateChapter, regeneratingIndex }: Props) => {
  const { t, lang } = useLanguage();
  const { isFree } = useUserPlan();
  const { settings } = usePlatformSettings();
  const maxPagesPerChapter = isFree ? (settings.plan_free_max_pages_per_chapter || 3) : 50;

  const handleChapterCountChange = (val: string) => {
    const count = parseInt(val);
    const newChapters = getDefaultChapters(count);
    const defaultPages = isFree ? maxPagesPerChapter : 10;
    const newPages = newChapters.map((_, i) => Math.min(project.chapter_pages?.[i] || defaultPages, maxPagesPerChapter));
    onUpdate({ chapter_count: count, chapters: newChapters, chapter_pages: newPages });
  };

  const handlePageChange = (index: number, pages: number) => {
    let clamped = pages;
    if (isFree && pages > maxPagesPerChapter) {
      clamped = maxPagesPerChapter;
      toast({
        title: lang === 'ar'
          ? `الخطة المجانية محدودة بـ ${maxPagesPerChapter} صفحات لكل فصل. للترقية تواصل عبر صفحة الاشتراكات.`
          : `Free plan is limited to ${maxPagesPerChapter} pages per chapter. Upgrade for more.`,
          variant: 'destructive',
      });
    }
    const updated = [...(project.chapter_pages || project.chapters.map(() => 10))];
    updated[index] = clamped;
    onUpdate({ chapter_pages: updated });
  };

  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-lg">{t('projectInputs')}</h3>

      <div className="space-y-2">
        <Label>{t('projectType')}</Label>
        <Select value={project.project_type || 'research'} onValueChange={(v) => onUpdate({ project_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="research">{t('projectTypeResearch')}</SelectItem>
            <SelectItem value="project">{t('projectTypeProject')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('researchTitle')}</Label>
        <Input value={project.title} onChange={(e) => onUpdate({ title: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>{t('researchAbstract')}</Label>
        <Textarea value={project.abstract} onChange={(e) => onUpdate({ abstract: e.target.value })} rows={4} />
      </div>

      <div className="space-y-2">
        <Label>{t('researchLanguage')}</Label>
        <Select value={project.research_language} onValueChange={(v) => onUpdate({ research_language: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ar">{t('arabic')}</SelectItem>
            <SelectItem value="en">{t('english')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('textDirection')}</Label>
        <Select value={project.text_direction || 'rtl'} onValueChange={(v) => onUpdate({ text_direction: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rtl">{t('rtl')}</SelectItem>
            <SelectItem value="ltr">{t('ltr')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('customReferences')}</Label>
        <Textarea
          value={project.custom_references}
          onChange={(e) => onUpdate({ custom_references: e.target.value })}
          placeholder={t('customReferencesPlaceholder')}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('referenceCount')}</Label>
        <Input
          type="number"
          min={1}
          max={50}
          value={project.reference_count || 10}
          onChange={(e) => onUpdate({ reference_count: parseInt(e.target.value) || 10 })}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('chapterCount')}</Label>
        <Select value={String(project.chapter_count)} onValueChange={handleChapterCountChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="4">4</SelectItem>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="6">6</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ChapterList
        chapters={project.chapters}
        chapterCount={project.chapter_count}
        chapterPages={project.chapter_pages || project.chapters.map(() => 10)}
        onChange={(chapters) => onUpdate({ chapters })}
        onPageChange={handlePageChange}
        onRegenerate={onRegenerateChapter}
        regeneratingIndex={regeneratingIndex}
      />

      {/* Front Matter Options */}
      <div className="space-y-3">
        <Label>{lang === 'ar' ? 'القوائم والفهارس' : 'Front Matter'}</Label>
        <div className="flex items-center gap-2">
          <Checkbox
            id="include_toc"
            checked={project.include_toc || false}
            onCheckedChange={(v) => onUpdate({ include_toc: !!v })}
          />
          <label htmlFor="include_toc" className="text-sm cursor-pointer">
            {lang === 'ar' ? 'جدول المحتويات' : 'Table of Contents'}
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="include_list_of_figures"
            checked={project.include_list_of_figures || false}
            onCheckedChange={(v) => onUpdate({ include_list_of_figures: !!v })}
          />
          <label htmlFor="include_list_of_figures" className="text-sm cursor-pointer">
            {lang === 'ar' ? 'قائمة الأشكال' : 'List of Figures'}
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="include_list_of_tables"
            checked={project.include_list_of_tables || false}
            onCheckedChange={(v) => onUpdate({ include_list_of_tables: !!v })}
          />
          <label htmlFor="include_list_of_tables" className="text-sm cursor-pointer">
            {lang === 'ar' ? 'قائمة الجداول' : 'List of Tables'}
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="include_abbreviations"
            checked={project.include_abbreviations || false}
            onCheckedChange={(v) => onUpdate({ include_abbreviations: !!v })}
          />
          <label htmlFor="include_abbreviations" className="text-sm cursor-pointer">
            {lang === 'ar' ? 'قائمة الاختصارات' : 'List of Abbreviations'}
          </label>
        </div>
      </div>

      {/* Content Options */}
      <div className="space-y-3">
        <Label>{t('tablesAndLists')}</Label>
        <div className="flex items-center gap-2">
          <Checkbox
            id="include_images"
            checked={isFree ? false : (project.include_images || false)}
            onCheckedChange={(v) => {
              if (isFree) {
                toast({
                  title: lang === 'ar' ? 'الصور متاحة في الخطط المدفوعة فقط' : 'Images available on paid plans only',
                  variant: 'destructive',
                });
                return;
              }
              onUpdate({ include_images: !!v });
            }}
          />
          <label htmlFor="include_images" className={`text-sm cursor-pointer ${isFree ? 'text-muted-foreground' : ''}`}>
            {lang === 'ar' ? 'إضافة صور توضيحية مع عناوين' : 'Add illustrative images with captions'}
            {isFree && <span className="text-xs text-amber-600 ms-1">({lang === 'ar' ? 'مدفوع' : 'Paid'})</span>}
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="include_data_tables"
            checked={project.include_data_tables || false}
            onCheckedChange={(v) => onUpdate({ include_data_tables: !!v })}
          />
          <label htmlFor="include_data_tables" className="text-sm cursor-pointer">
            {lang === 'ar' ? 'إضافة جداول بيانات' : 'Add data tables'}
          </label>
        </div>
      </div>

      {project.include_images && !isFree && (
        <div className="space-y-2">
          <Label>{lang === 'ar' ? 'جودة الصور' : 'Image Quality'}</Label>
          <Select value={project.image_quality || 'standard'} onValueChange={(v) => onUpdate({ image_quality: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">{lang === 'ar' ? 'عادية (أسرع)' : 'Standard (Faster)'}</SelectItem>
              <SelectItem value="high">{lang === 'ar' ? 'عالية الجودة (أبطأ)' : 'High Quality (Slower)'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Button onClick={onGenerate} disabled={generating || !project.title} className="w-full gap-2">
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {t('generateResearch')}
      </Button>
    </div>
  );
};
