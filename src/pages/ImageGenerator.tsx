import { useState, useRef } from 'react';
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
  const imgRef = useRef<HTMLImageElement>(null);
  const isAr = lang === 'ar';

  const generateImage = () => {
    if (!description.trim()) return;
    setLoading(true);
    setImageLoaded(false);
    setImageUrl('');

    const baseUrl = "https://image.pollinations.ai/prompt/";
    const enhancements = ", professional studio photography, cinematic lighting, 8k resolution, hyper-realistic, product shot, isolated on clean background, industrial design";
    const seed = Math.floor(Math.random() * 100000);
    const params = `?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;
    const finalUrl = `${baseUrl}${encodeURIComponent(description.trim() + enhancements)}${params}`;

    // Use a fresh URL to avoid caching issues
    setImageUrl(finalUrl);
  };

  const downloadImage = () => {
    if (!imgRef.current || !imageLoaded) return;
    try {
      // Draw the loaded image to canvas to bypass CORS download restrictions
      const canvas = document.createElement('canvas');
      canvas.width = imgRef.current.naturalWidth;
      canvas.height = imgRef.current.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.drawImage(imgRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          // Fallback: open image in new tab
          window.open(imageUrl, '_blank');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `generated-image-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: isAr ? 'تم تنزيل الصورة بنجاح' : 'Image downloaded successfully' });
      }, 'image/png');
    } catch {
      // Fallback: open in new tab for manual save
      window.open(imageUrl, '_blank');
      toast({ title: isAr ? 'تم فتح الصورة في نافذة جديدة - احفظها يدوياً' : 'Image opened in new tab - save manually' });
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
                ref={imgRef}
                src={imageUrl}
                alt="Generated"
                className="w-full h-auto"
                crossOrigin="anonymous"
                onLoad={() => { setLoading(false); setImageLoaded(true); }}
                onError={() => {
                  setLoading(false);
                  setImageLoaded(false);
                  toast({ title: isAr ? 'فشل في توليد الصورة. حاول مرة أخرى.' : 'Failed to generate image. Try again.', variant: 'destructive' });
                }}
              />
              {loading && !imageLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{isAr ? 'جاري توليد الصورة... قد يستغرق 10-30 ثانية' : 'Generating image... may take 10-30 seconds'}</p>
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
