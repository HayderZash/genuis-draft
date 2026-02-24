import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, ImageIcon, Download, Sparkles, FileText, FileSpreadsheet, Trash2, Clock, Cpu } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SavedImage {
  id: string;
  prompt: string;
  model: string;
  image_url: string;
  created_at: string;
}

const MODELS = [
  { key: 'stable-diffusion-xl', label: 'Stable Diffusion XL', labelAr: 'ستيبل ديفيوجن XL' },
  { key: 'flux-1-schnell', label: 'FLUX.1 Schnell', labelAr: 'فلكس 1 شنل (سريع)' },
  { key: 'dreamshaper', label: 'DreamShaper 8', labelAr: 'دريم شيبر 8' },
];

const ImageGenerator = () => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const { checkAndConsume } = useFeatureAccess();
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('stable-diffusion-xl');
  const [gallery, setGallery] = useState<SavedImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const isAr = lang === 'ar';

  // Fetch gallery
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

    // Check points
    const allowed = await checkAndConsume('image-gen', lang);
    if (!allowed) return;

    setLoading(true);
    setImageUrl('');

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt: description.trim(), model: selectedModel },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);

        // Save to database
        if (user) {
          const { data: saved, error: saveErr } = await supabase.from('generated_images').insert({
            user_id: user.id,
            prompt: description.trim(),
            model: selectedModel,
            image_url: data.imageUrl,
          }).select().single();

          if (saved) {
            setGallery(prev => [saved as SavedImage, ...prev]);
          }
          if (saveErr) console.error('Save error:', saveErr);
        }
      } else {
        throw new Error('No image returned');
      }
    } catch (err: any) {
      toast({
        title: isAr ? 'فشل في توليد الصورة' : 'Failed to generate image',
        description: err.message,
        variant: 'destructive',
      });
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

  const modelLabel = (key: string) => {
    const m = MODELS.find(m => m.key === key);
    return isAr ? m?.labelAr || key : m?.label || key;
  };

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4" dir="rtl">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 mb-6">
        <ArrowLeft className="h-4 w-4 rotate-180" />
        {isAr ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
      </Button>

      <Tabs defaultValue="image-gen" className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-12 mb-8 bg-muted/60 rounded-xl p-1">
          <TabsTrigger value="image-gen" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg text-sm font-semibold">
            <ImageIcon className="h-4 w-4" />
            {isAr ? 'مُولد الصور الذكي' : 'AI Image Generator'}
          </TabsTrigger>
          <TabsTrigger value="research" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg text-sm font-semibold">
            <FileText className="h-4 w-4" />
            {isAr ? 'البحوث والتقارير' : 'Research & Reports'}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Image Generator */}
        <TabsContent value="image-gen" className="space-y-6">
          <div className="text-center mb-6">
            <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
              <ImageIcon className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">{isAr ? 'مُولد الصور الذكي' : 'AI Image Generator'}</h1>
            <p className="text-muted-foreground mt-2">
              {isAr ? 'أنشئ صورًا احترافية بالذكاء الاصطناعي • تكلفة 0.1 نقطة' : 'Generate AI images • Costs 0.1 points'}
            </p>
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="font-semibold">{isAr ? 'وصف الصورة المطلوبة' : 'Image description'}</Label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={isAr ? 'أدخل وصف الصورة هنا...' : 'Enter image description...'}
                  onKeyDown={e => e.key === 'Enter' && generateImage()}
                  className="h-12 text-base"
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  {isAr ? 'نموذج الذكاء الاصطناعي' : 'AI Model'}
                </Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map(m => (
                      <SelectItem key={m.key} value={m.key}>
                        {isAr ? m.labelAr : m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={generateImage} disabled={!description.trim() || loading} className="w-full gap-2 h-12 text-base font-semibold">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {loading ? (isAr ? 'جاري التوليد...' : 'Generating...') : (isAr ? 'توليد الصورة' : 'Generate Image')}
              </Button>
            </CardContent>
          </Card>

          {loading && (
            <Card className="border-border/50">
              <CardContent className="py-16 flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{isAr ? 'جاري التوليد... قد يستغرق 10-30 ثانية' : 'Generating... may take 10-30 seconds'}</p>
              </CardContent>
            </Card>
          )}

          {imageUrl && !loading && (
            <Card className="border-border/50 shadow-lg overflow-hidden">
              <CardContent className="pt-6 space-y-4">
                <div className="rounded-xl overflow-hidden border bg-muted">
                  <img src={imageUrl} alt="Generated" className="w-full h-auto" />
                </div>
                <Button onClick={() => downloadImage(imageUrl)} variant="outline" className="w-full gap-2 h-11">
                  <Download className="h-4 w-4" />
                  {isAr ? 'تحميل الصورة' : 'Download Image'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Gallery */}
          <div className="pt-4">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              {isAr ? 'معرض الصور السابقة' : 'Previous Images Gallery'}
            </h2>
            {galleryLoading ? (
              <div className="text-center py-8 text-muted-foreground">...</div>
            ) : gallery.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>{isAr ? 'لا توجد صور سابقة' : 'No previous images'}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {gallery.map(img => (
                  <Card key={img.id} className="group overflow-hidden border-border/50 hover:shadow-lg transition-all">
                    <div className="aspect-square overflow-hidden bg-muted">
                      <img src={img.image_url} alt={img.prompt} className="w-full h-full object-cover" />
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-medium truncate" title={img.prompt}>{img.prompt}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">{modelLabel(img.model)}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(img.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => downloadImage(img.image_url)}>
                          <Download className="h-3 w-3" />
                          {isAr ? 'تحميل' : 'Download'}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteImage(img.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Research & Reports */}
        <TabsContent value="research">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
              <FileText className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">{isAr ? 'البحوث والتقارير' : 'Research & Reports'}</h1>
            <p className="text-muted-foreground mt-2">
              {isAr ? 'الوصول السريع لإنشاء بحوث وتقارير أكاديمية' : 'Quick access to create academic research and reports'}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="group cursor-pointer border-border/50 hover:border-primary/40 hover:shadow-xl transition-all duration-300" onClick={() => navigate('/research')}>
              <CardContent className="p-8 text-center">
                <div className="inline-flex p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors mb-4">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">{isAr ? 'البحوث الأكاديمية' : 'Academic Research'}</h3>
                <p className="text-sm text-muted-foreground">{isAr ? 'إنشاء بحوث تخرج كاملة مع توليد صور تلقائي' : 'Create full graduation research with auto image generation'}</p>
              </CardContent>
            </Card>
            <Card className="group cursor-pointer border-border/50 hover:border-primary/40 hover:shadow-xl transition-all duration-300" onClick={() => navigate('/reports')}>
              <CardContent className="p-8 text-center">
                <div className="inline-flex p-4 rounded-2xl bg-accent group-hover:bg-accent/80 transition-colors mb-4">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">{isAr ? 'التقارير العلمية' : 'Scientific Reports'}</h3>
                <p className="text-sm text-muted-foreground">{isAr ? 'إنشاء تقارير احترافية مع رسومات توضيحية' : 'Create professional reports with illustrations'}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ImageGenerator;
