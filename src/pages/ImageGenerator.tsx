import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Download, Sparkles, Trash2, Wand2, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SavedImage {
  id: string;
  prompt: string;
  model: string;
  image_url: string;
  created_at: string;
}

const ImageGenerator = () => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const { checkAndConsume } = useFeatureAccess();
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [gallery, setGallery] = useState<SavedImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const isAr = lang === 'ar';

  useEffect(() => {
    const fetchGallery = async () => {
      const { data } = await supabase
        .from('generated_images')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setGallery((data as SavedImage[]) || []);
      setGalleryLoading(false);
    };
    if (user) fetchGallery();
  }, [user]);

  const generateImage = async () => {
    if (!description.trim()) return;
    const allowed = await checkAndConsume('image-gen', lang);
    if (!allowed) return;

    setLoading(true);
    setImageUrl('');

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt: description.trim(), model: 'standard' },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);
        if (user) {
          const { data: saved } = await supabase.from('generated_images').insert({
            user_id: user.id,
            prompt: description.trim(),
            model: data.model || 'standard',
            image_url: data.imageUrl,
          }).select().single();
          if (saved) setGallery(prev => [saved as SavedImage, ...prev]);
        }
      } else {
        throw new Error('No image returned');
      }
    } catch (err: any) {
      toast({ title: isAr ? 'فشل في توليد الصورة' : 'Failed to generate image', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = (url: string) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: isAr ? 'تم تنزيل الصورة' : 'Image downloaded' });
    } catch {
      window.open(url, '_blank');
    }
  };

  const deleteImage = async (id: string) => {
    await supabase.from('generated_images').delete().eq('id', id);
    setGallery(prev => prev.filter(img => img.id !== id));
    toast({ title: isAr ? 'تم حذف الصورة' : 'Image deleted' });
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-background to-muted/20" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto max-w-4xl flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} />
            {isAr ? 'العودة' : 'Back'}
          </Button>
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-lg">{isAr ? 'مُولد الصور' : 'Image Generator'}</h1>
          </div>
          <Badge variant="secondary" className="text-xs">0.1 {isAr ? 'نقطة' : 'pt'}</Badge>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-8">
        {/* Generator */}
        <div className="relative rounded-2xl border bg-card p-6 shadow-sm">
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={isAr ? 'صِف الصورة التي تريد توليدها...\nمثال: قطة برتقالية تجلس على نافذة مع غروب الشمس' : 'Describe the image you want to generate...\ne.g. Orange cat sitting on a window with sunset'}
            className="min-h-[100px] resize-none border-0 bg-transparent text-base focus-visible:ring-0 p-0 placeholder:text-muted-foreground/50"
            dir="auto"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateImage(); } }}
          />
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {isAr ? 'اضغط Enter للتوليد • Shift+Enter لسطر جديد' : 'Press Enter to generate • Shift+Enter for new line'}
            </p>
            <Button
              onClick={generateImage}
              disabled={!description.trim() || loading}
              size="sm"
              className="gap-2 px-6 rounded-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? (isAr ? 'جاري التوليد...' : 'Generating...') : (isAr ? 'توليد' : 'Generate')}
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-muted animate-pulse" />
              <Loader2 className="h-8 w-8 text-primary animate-spin absolute top-4 left-4" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">
              {isAr ? 'جاري إنشاء صورتك... قد يستغرق 10-30 ثانية' : 'Creating your image... may take 10-30 seconds'}
            </p>
          </div>
        )}

        {/* Generated Image */}
        {imageUrl && !loading && (
          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
            <div className="bg-muted/30">
              <img src={imageUrl} alt="Generated" className="w-full h-auto max-h-[500px] object-contain" />
            </div>
            <div className="p-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground truncate flex-1 me-4">{description}</p>
              <Button onClick={() => downloadImage(imageUrl)} size="sm" variant="outline" className="gap-2 rounded-full shrink-0">
                <Download className="h-4 w-4" />
                {isAr ? 'تحميل' : 'Download'}
              </Button>
            </div>
          </div>
        )}

        {/* Gallery */}
        {!galleryLoading && gallery.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              {isAr ? 'الصور السابقة' : 'Previous Images'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {gallery.map(img => (
                <div key={img.id} className="group relative rounded-xl overflow-hidden border bg-card hover:shadow-md transition-all">
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img src={img.image_url} alt={img.prompt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3">
                    <p className="text-white text-xs text-center line-clamp-3">{img.prompt}</p>
                    <div className="flex gap-2">
                      <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => downloadImage(img.image_url)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="destructive" className="h-8 w-8 rounded-full" onClick={() => deleteImage(img.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!galleryLoading && gallery.length === 0 && !imageUrl && !loading && (
          <div className="text-center py-16">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">{isAr ? 'ابدأ بكتابة وصف لتوليد أول صورة' : 'Start by writing a description to generate your first image'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGenerator;
