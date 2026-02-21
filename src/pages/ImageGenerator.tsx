import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, ImageIcon, Download, Sparkles } from 'lucide-react';
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
    <div className="container mx-auto max-w-3xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {isAr ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
      </Button>

      <div className="text-center mb-8">
        <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
          <ImageIcon className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">{isAr ? 'مولد الصور الاحترافية' : 'Professional Image Generator'}</h2>
        <p className="text-muted-foreground mt-2">{isAr ? 'إنشاء صور احترافية بالذكاء الاصطناعي' : 'Generate professional AI images'}</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>{isAr ? 'اسم المنتج أو وصفه' : 'Product name or description'}</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={isAr ? 'أدخل اسم المنتج أو وصفه هنا...' : 'Enter product name or description...'}
              onKeyDown={e => e.key === 'Enter' && generateImage()}
            />
          </div>
          <Button onClick={generateImage} disabled={!description.trim() || loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isAr ? 'إنشاء صورة استوديو' : 'Generate Studio Image'}
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{isAr ? 'جاري توليد الصورة... قد يستغرق 10-30 ثانية' : 'Generating image... may take 10-30 seconds'}</p>
          </CardContent>
        </Card>
      )}

      {imageUrl && !loading && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="rounded-xl overflow-hidden border bg-muted">
              <img src={imageUrl} alt="Generated" className="w-full h-auto" />
            </div>
            <Button onClick={downloadImage} variant="outline" className="w-full gap-2">
              <Download className="h-4 w-4" />
              {isAr ? 'تنزيل الصورة' : 'Download Image'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImageGenerator;
