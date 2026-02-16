import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChapterList } from './ChapterList';
import { Loader2, Sparkles } from 'lucide-react';
import type { ProjectData } from '@/pages/ProjectEditor';

interface Props {
  project: ProjectData;
  onUpdate: (updates: Partial<ProjectData>) => void;
  onGenerate: () => void;
  generating: boolean;
}

export const ProjectSidebar = ({ project, onUpdate, onGenerate, generating }: Props) => {
  const { t } = useLanguage();

  const handleChapterCountChange = (val: string) => {
    const count = parseInt(val);
    const { getDefaultChapters } = require('@/pages/Dashboard');
    onUpdate({ chapter_count: count, chapters: getDefaultChapters(count) });
  };

  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-lg">{t('projectInputs')}</h3>

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
        <Label>{t('customReferences')}</Label>
        <Textarea
          value={project.custom_references}
          onChange={(e) => onUpdate({ custom_references: e.target.value })}
          placeholder={t('customReferencesPlaceholder')}
          rows={3}
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
        onChange={(chapters) => onUpdate({ chapters })}
      />

      <Button onClick={onGenerate} disabled={generating || !project.title} className="w-full gap-2">
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {t('generateResearch')}
      </Button>
    </div>
  );
};
