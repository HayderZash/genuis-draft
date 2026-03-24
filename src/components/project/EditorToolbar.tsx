import { type Editor } from '@tiptap/react';
import { Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useRef } from 'react';

interface Props {
  editor: Editor | null;
}

export const EditorToolbar = ({ editor }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `h-8 w-8 ${active ? 'bg-accent text-accent-foreground' : ''}`;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image file', variant: 'destructive' });
      return;
    }

    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `uploaded/img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('research-images').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const publicUrl = supabase.storage.from('research-images').getPublicUrl(path).data.publicUrl;
      
      editor.chain().focus().setImage({ src: publicUrl }).run();
      toast({ title: 'Image uploaded successfully' });
    } catch (err: any) {
      toast({ title: err.message || 'Upload failed', variant: 'destructive' });
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex items-center gap-1 border-b px-4 py-1.5 bg-muted/30 flex-wrap">
      <Button variant="ghost" size="icon" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Button variant="ghost" size="icon" className={btn(editor.isActive({ textAlign: 'left' }))} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive({ textAlign: 'center' }))} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenter className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive({ textAlign: 'right' }))} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive({ textAlign: 'justify' }))} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
        <AlignJustify className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fileInputRef.current?.click()} title="Upload Image">
        <ImagePlus className="h-4 w-4" />
      </Button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
    </div>
  );
};
