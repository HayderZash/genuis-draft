import { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { EditorToolbar } from './EditorToolbar';
import type { ProjectData } from '@/pages/ProjectEditor';

interface Props {
  project: ProjectData;
  onContentChange: (content: Record<string, string>) => void;
}

export const ResearchEditor = ({ project, onContentChange }: Props) => {
  const { lang } = useLanguage();
  const isExternalUpdate = useRef(false);
  const lastContentRef = useRef<string>('');
  // Keep latest project.content in ref to avoid stale closures
  const contentRef = useRef(project.content);
  contentRef.current = project.content;

  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  const buildHtml = useCallback(() => {
    const c = contentRef.current;
    if (!c || Object.keys(c).length === 0) {
      return `<p style="text-align:center;color:#999;">${lang === 'ar' ? 'لم يتم توليد المحتوى بعد. استخدم الشريط الجانبي لتوليد البحث.' : 'No content generated yet. Use the sidebar to generate research.'}</p>`;
    }
    if (c._full) return c._full;

    let html = '';
    if (c['abstract']) html += c['abstract'];
    project.chapters.forEach((_, i) => {
      html += c[`chapter_${i}`] || '';
    });
    if (c['references']) html += c['references'];
    return html;
  }, [lang, project.chapters]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: buildHtml(),
    editorProps: {
      attributes: {
        class: 'prose max-w-none p-8 min-h-[60vh] focus:outline-none research-editor',
        style: 'font-family: "Times New Roman", Times, serif; font-size: 14px; text-align: justify;',
      },
    },
    onUpdate: ({ editor }) => {
      if (isExternalUpdate.current) return;
      // Use ref to get latest content, not stale closure
      onContentChangeRef.current({ ...contentRef.current, _full: editor.getHTML() });
    },
  });

  useEffect(() => {
    if (!editor || !project.content) return;
    const keys = Object.keys(project.content).filter(k => k !== '_full');
    if (keys.length === 0) return;

    const newHtml = buildHtml();
    if (newHtml === lastContentRef.current) return;

    console.log('[Editor] Updating content, keys:', keys.join(', '));
    lastContentRef.current = newHtml;
    isExternalUpdate.current = true;
    editor.commands.setContent(newHtml);
    setTimeout(() => { isExternalUpdate.current = false; }, 500);
  }, [project.content, editor, buildHtml]);

  return (
    <div className="bg-background">
      <style>{`
        .research-editor h1 { font-size: 22px; text-align: center; font-weight: bold; margin: 1.5em 0 0.5em; }
        .research-editor h2 { font-size: 18px; font-weight: bold; margin: 1.2em 0 0.4em; }
        .research-editor h3 { font-size: 16px; font-weight: bold; text-decoration: underline; margin: 1em 0 0.3em; }
        .research-editor p { font-size: 14px; line-height: 1.8; margin: 0.5em 0; text-align: justify; }
        .research-editor p.figure-caption,
        .research-editor p[style*="font-style:italic"][style*="text-align:center"] { 
          font-size: 12px !important; 
          font-style: italic !important; 
          text-align: center !important; 
          margin: 0.5em 0 1em; 
          color: #333;
        }
        .research-editor img { max-width: 80%; border-radius: 8px; margin: 12px auto; display: block; }
        .research-editor .generated-figure { text-align: center; margin: 16px 0; }
        .research-editor { font-family: "Times New Roman", Times, serif; }
        .ProseMirror { min-height: 60vh; }
        .ProseMirror:focus { outline: none; }
        .ProseMirror img { max-width: 80%; border-radius: 8px; margin: 12px auto; display: block; }
      `}</style>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};
