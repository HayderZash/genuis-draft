import { useLanguage } from '@/contexts/LanguageContext';
import { ImageIcon, TableIcon, FileTextIcon } from 'lucide-react';
import type { ProjectData } from '@/pages/ProjectEditor';

interface Props {
  project: ProjectData;
}

export const ContentQualityIndicator = ({ project }: Props) => {
  const { lang } = useLanguage();
  const content = project.content;
  if (!content || Object.keys(content).filter(k => k !== '_full').length === 0) return null;

  const stats = project.chapters.map((ch, i) => {
    const html = content[`chapter_${i}`] || '';
    const imgCount = (html.match(/<img\s/gi) || []).length;
    const tableCount = (html.match(/<table[\s>]/gi) || []).length;
    const figureCount = (html.match(/\[Figure\s+[\d.]+:/gi) || []).length;
    const wordCount = html.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
    return {
      name: lang === 'ar' ? ch.nameAr : ch.name,
      imgCount,
      tableCount,
      figureCount,
      wordCount,
    };
  });

  const totalImages = stats.reduce((s, c) => s + c.imgCount, 0);
  const totalTables = stats.reduce((s, c) => s + c.tableCount, 0);
  const totalWords = stats.reduce((s, c) => s + c.wordCount, 0);

  return (
    <div className="border rounded-lg p-3 mx-4 my-2 bg-muted/30 text-sm space-y-2">
      <div className="flex items-center gap-4 font-medium text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><FileTextIcon className="h-3.5 w-3.5" /> {totalWords} {lang === 'ar' ? 'كلمة' : 'words'}</span>
        <span className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> {totalImages} {lang === 'ar' ? 'صورة' : 'images'}</span>
        <span className="flex items-center gap-1"><TableIcon className="h-3.5 w-3.5" /> {totalTables} {lang === 'ar' ? 'جدول' : 'tables'}</span>
      </div>
      <div className="grid gap-1">
        {stats.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs py-0.5 border-t border-border/50">
            <span className="truncate max-w-[160px]">{s.name}</span>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>{s.wordCount} {lang === 'ar' ? 'ك' : 'w'}</span>
              {s.imgCount > 0 && <span className="text-green-600">🖼 {s.imgCount}</span>}
              {s.tableCount > 0 && <span className="text-blue-600">📊 {s.tableCount}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
