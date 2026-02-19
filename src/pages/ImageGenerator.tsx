import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, ImageIcon, Download, Sparkles } from 'lucide-react';

const ImageGenerator = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const isAr = lang === 'ar';

  const baseUrl = "https://image.pollinations.ai/prompt/";
  const enhancements = " professional studio photography, cinematic lighting, 8k resolution, hyper-realistic, product shot, isolated on clean background, industrial design";

  const generateImage = () => {
    if (!description.trim()) return;
    setLoading(true);
    const params = `?width=1024&height=1024&model=flux&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
    const finalUrl = `${baseUrl}${encodeURIComponent(description.trim() + enhancements)}${params}`;
    setImageUrl(finalUrl);
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'generated-image.png';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <Button onClick={generateImage} disabled={!description.trim()} className="w-full gap-2">
            <Sparkles className="h-4 w-4" />
            {isAr ? 'إنشاء صورة استوديو' : 'Generate Studio Image'}
          </Button>
        </CardContent>
      </Card>

      {imageUrl && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="relative rounded-xl overflow-hidden border bg-muted">
              <img
                src={imageUrl}
                alt="Generated"
                className="w-full h-auto"
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
              />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
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
