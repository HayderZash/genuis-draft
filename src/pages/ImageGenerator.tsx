import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, ImageIcon, Download, Sparkles, FileText, FileSpreadsheet } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ImageGenerator = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const isAr = lang === 'ar';

  const generateImage = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setImageUrl('');

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt: description.trim() },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);
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

  const downloadImage = () => {
    if (!imageUrl) return;
    try {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: isAr ? 'تم تنزيل الصورة بنجاح' : 'Image downloaded successfully' });
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4" dir="rtl">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 mb-6">
        <ArrowLeft className="h-4 w-4 rotate-180" />
        {isAr ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
      </Button>

      <Tabs defaultValue="image-gen" className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-12 mb-8 bg-muted/60 rounded-xl p-1">
          <TabsTrigger
            value="image-gen"
            className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg text-sm font-semibold transition-all"
          >
            <ImageIcon className="h-4 w-4" />
            {isAr ? 'مُولد الصور الذكي' : 'AI Image Generator'}
          </TabsTrigger>
          <TabsTrigger
            value="research"
            className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg text-sm font-semibold transition-all"
          >
            <FileText className="h-4 w-4" />
            {isAr ? 'البحوث والتقارير' : 'Research & Reports'}
          </TabsTrigger>
        </TabsList>

        {/* ===== Tab 1: Image Generator ===== */}
        <TabsContent value="image-gen">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
              <ImageIcon className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">{isAr ? 'مُولد الصور الذكي' : 'AI Image Generator'}</h1>
            <p className="text-muted-foreground mt-2">
              {isAr ? 'أنشئ صورًا احترافية بالذكاء الاصطناعي باستخدام Stable Diffusion' : 'Generate professional AI images with Stable Diffusion'}
            </p>
          </div>

          <Card className="mb-6 border-border/50 shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="font-semibold">{isAr ? 'وصف الصورة المطلوبة' : 'Image description'}</Label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={isAr ? 'أدخل وصف الصورة هنا... مثال: منظر طبيعي، منتج، شعار...' : 'Enter image description...'}
                  onKeyDown={e => e.key === 'Enter' && generateImage()}
                  className="h-12 text-base"
                  dir="rtl"
                />
              </div>
              <Button onClick={generateImage} disabled={!description.trim() || loading} className="w-full gap-2 h-12 text-base font-semibold">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {loading
                  ? (isAr ? 'جاري التوليد... (قد يستغرق بضع ثوانٍ)' : 'Generating...')
                  : (isAr ? 'توليد الصورة' : 'Generate Image')}
              </Button>
            </CardContent>
          </Card>

          {loading && (
            <Card className="border-border/50 shadow-lg">
              <CardContent className="py-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{isAr ? 'جاري توليد الصورة... قد يستغرق 10-30 ثانية' : 'Generating image... may take 10-30 seconds'}</p>
              </CardContent>
            </Card>
          )}

          {imageUrl && !loading && (
            <Card className="border-border/50 shadow-lg">
              <CardContent className="pt-6 space-y-4">
                <div className="rounded-xl overflow-hidden border bg-muted">
                  <img src={imageUrl} alt="Generated" className="w-full h-auto" />
                </div>
                <Button onClick={downloadImage} variant="outline" className="w-full gap-2 h-11">
                  <Download className="h-4 w-4" />
                  {isAr ? 'تحميل الصورة' : 'Download Image'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Tab 2: Research & Reports ===== */}
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
            <Card
              className="group cursor-pointer border-border/50 hover:border-primary/40 hover:shadow-xl transition-all duration-300"
              onClick={() => navigate('/research')}
            >
              <CardContent className="p-8 text-center">
                <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors mb-4">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">{isAr ? 'البحوث الأكاديمية' : 'Academic Research'}</h3>
                <p className="text-sm text-muted-foreground">
                  {isAr ? 'إنشاء بحوث تخرج كاملة مع توليد صور تلقائي' : 'Create full graduation research with auto image generation'}
                </p>
              </CardContent>
            </Card>

            <Card
              className="group cursor-pointer border-border/50 hover:border-primary/40 hover:shadow-xl transition-all duration-300"
              onClick={() => navigate('/reports')}
            >
              <CardContent className="p-8 text-center">
                <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors mb-4">
                  <FileSpreadsheet className="h-8 w-8 text-amber-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">{isAr ? 'التقارير العلمية' : 'Scientific Reports'}</h3>
                <p className="text-sm text-muted-foreground">
                  {isAr ? 'إنشاء تقارير احترافية مع رسومات توضيحية' : 'Create professional reports with illustrations'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ImageGenerator;
