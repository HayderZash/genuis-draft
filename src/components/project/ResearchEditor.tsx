import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
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

  const buildHtml = () => {
    if (!project.content || Object.keys(project.content).length === 0) {
      return `<p style="text-align:center;color:#999;">${lang === 'ar' ? 'لم يتم توليد المحتوى بعد. استخدم الشريط الجانبي لتوليد البحث.' : 'No content generated yet. Use the sidebar to generate research.'}</p>`;
    }
    // If _full exists (user edited), use it directly
    if (project.content._full) return project.content._full;

    let html = '';
    if (project.content['abstract']) html += project.content['abstract'];
    project.chapters.forEach((_, i) => {
      html += project.content[`chapter_${i}`] || '';
    });
    if (project.content['references']) html += project.content['references'];
    return html;
  };

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
      onContentChange({ ...project.content, _full: editor.getHTML() });
    },
  });

  useEffect(() => {
    if (!editor || !project.content) return;
    const keys = Object.keys(project.content).filter(k => k !== '_full');
    if (keys.length === 0) return;

    const newHtml = buildHtml();
    if (newHtml === lastContentRef.current) return;

    lastContentRef.current = newHtml;
    isExternalUpdate.current = true;
    editor.commands.setContent(newHtml);
    // Allow onUpdate to fire after external update settles
    setTimeout(() => { isExternalUpdate.current = false; }, 200);
  }, [project.content, editor]);

  return (
    <div className="bg-background">
      <style>{`
        .research-editor h1 { font-size: 22px; text-align: center; font-weight: bold; margin: 1.5em 0 0.5em; }
        .research-editor h2 { font-size: 18px; font-weight: bold; margin: 1.2em 0 0.4em; }
        .research-editor h3 { font-size: 16px; font-weight: bold; text-decoration: underline; margin: 1em 0 0.3em; }
        .research-editor p { font-size: 14px; line-height: 1.8; margin: 0.5em 0; text-align: justify; }
        .research-editor .figure-caption { font-size: 12px; font-style: italic; text-align: center; margin: 0.5em 0; }
        .research-editor img { max-width: 100%; border-radius: 8px; margin: 12px auto; display: block; }
        .research-editor { font-family: "Times New Roman", Times, serif; }
        .ProseMirror { min-height: 60vh; }
        .ProseMirror:focus { outline: none; }
      `}</style>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};
