import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, ImageIcon, Download, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const ImageGenerator = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const isAr = lang === 'ar';

  const baseUrl = "https://image.pollinations.ai/prompt/";
  const enhancements = " professional studio photography, cinematic lighting, 8k resolution, hyper-realistic, product shot, isolated on clean background, industrial design";

  const generateImage = () => {
    if (!description.trim()) return;
    setLoading(true);
    setImageLoaded(false);
    const seed = Math.floor(Math.random() * 100000);
    const params = `?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;
    const finalUrl = `${baseUrl}${encodeURIComponent(description.trim() + enhancements)}${params}`;
    setImageUrl(finalUrl);
  };

  const downloadImage = async () => {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to fetch');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast({ title: isAr ? 'فشل تنزيل الصورة' : 'Failed to download image', variant: 'destructive' });
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
            {loading && !imageLoaded ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isAr ? 'إنشاء صورة استوديو' : 'Generate Studio Image'}
          </Button>
        </CardContent>
      </Card>

      {imageUrl && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="relative rounded-xl overflow-hidden border bg-muted min-h-[300px]">
              <img
                src={imageUrl}
                alt="Generated"
                className="w-full h-auto"
                crossOrigin="anonymous"
                onLoad={() => { setLoading(false); setImageLoaded(true); }}
                onError={() => {
                  setLoading(false);
                  toast({ title: isAr ? 'فشل في توليد الصورة. حاول مرة أخرى.' : 'Failed to generate image. Try again.', variant: 'destructive' });
                }}
              />
              {loading && !imageLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{isAr ? 'جاري توليد الصورة...' : 'Generating image...'}</p>
                </div>
              )}
            </div>
            {imageLoaded && (
              <Button onClick={downloadImage} variant="outline" className="w-full gap-2">
                <Download className="h-4 w-4" />
                {isAr ? 'تنزيل الصورة' : 'Download Image'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImageGenerator;
