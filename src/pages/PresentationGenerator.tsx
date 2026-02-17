import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Presentation, Download, FileDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import pptxgen from 'pptxgenjs';

interface Slide {
  title: string;
  points: string[];
  notes: string;
}

const PresentationGenerator = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [slideCount, setSlideCount] = useState(10);
  const [language, setLanguage] = useState<string>('ar');
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);

  const handleGenerate = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: lang === 'ar' ? 'يرجى إدخال العنوان والمحتوى' : 'Please enter title and content', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setSlides([]);
    try {
      const { data, error } = await supabase.functions.invoke('generate-presentation', {
        body: { title: title.trim(), content: content.trim(), slideCount, language },
      });
      if (error) throw error;
      const resultText = data?.result || '';
      let parsed: { slides: Slide[] };
      try {
        const jsonMatch = resultText.match(/```json?\s*([\s\S]*?)```/) || resultText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : resultText;
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = { slides: [] };
        toast({ title: lang === 'ar' ? 'خطأ في تحليل النتيجة' : 'Error parsing result', variant: 'destructive' });
      }
      setSlides(parsed.slides || []);
    } catch (err: any) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportAsPPTX = () => {
    const isRtl = language === 'ar';
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE';
    if (isRtl) pres.rtlMode = true;

    slides.forEach((slide) => {
      const s = pres.addSlide();
      s.addText(slide.title, {
        x: 0.5, y: 0.3, w: '90%', h: 1,
        fontSize: 28, bold: true, color: '1e40af',
        align: isRtl ? 'right' : 'left',
      });
      const bulletPoints = slide.points.map(p => ({ text: p, options: { fontSize: 18, bullet: true, breakLine: true } }));
      s.addText(bulletPoints as any, {
        x: 0.8, y: 1.5, w: '85%', h: 4,
        align: isRtl ? 'right' : 'left',
        color: '333333',
        lineSpacingMultiple: 1.5,
      });
      if (slide.notes) {
        s.addNotes(slide.notes);
      }
    });

    pres.writeFile({ fileName: `${title || 'presentation'}.pptx` });
  };

  const exportAsHTML = () => {
    const isRtl = language === 'ar';
    let html = `<!DOCTYPE html><html dir="${isRtl ? 'rtl' : 'ltr'}"><head><meta charset="UTF-8"><title>${title}</title>
<style>
body { font-family: 'Times New Roman', Times, serif; margin: 0; padding: 0; }
.slide { width: 100%; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: 60px 80px; box-sizing: border-box; page-break-after: always; border-bottom: 3px solid #2563eb; }
.slide-title { font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 30px; text-align: center; }
.slide-points { font-size: 22px; line-height: 2; }
.slide-points li { margin-bottom: 12px; }
.slide-notes { font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; font-style: italic; }
.slide-number { position: absolute; bottom: 20px; ${isRtl ? 'left' : 'right'}: 30px; font-size: 14px; color: #999; }
@media print { .slide { page-break-after: always; } }
</style></head><body>`;

    slides.forEach((slide, i) => {
      html += `<div class="slide" style="position:relative;">
        <h1 class="slide-title">${slide.title}</h1>
        <ul class="slide-points">${slide.points.map(p => `<li>${p}</li>`).join('')}</ul>
        ${slide.notes ? `<div class="slide-notes">${isRtl ? 'ملاحظات: ' : 'Notes: '}${slide.notes}</div>` : ''}
        <div class="slide-number">${i + 1} / ${slides.length}</div>
      </div>`;
    });

    html += '</body></html>';

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'presentation'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printSlides = () => {
    const isRtl = language === 'ar';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let html = `<html dir="${isRtl ? 'rtl' : 'ltr'}"><head><title>${title}</title>
<style>
body { font-family: 'Times New Roman', Times, serif; margin: 0; }
.slide { width: 100%; height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: 60px 80px; box-sizing: border-box; page-break-after: always; }
.slide-title { font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 30px; text-align: center; }
.slide-points { font-size: 22px; line-height: 2; }
.slide-points li { margin-bottom: 12px; }
@media print { .slide { page-break-after: always; } }
</style></head><body>`;

    slides.forEach((slide) => {
      html += `<div class="slide">
        <h1 class="slide-title">${slide.title}</h1>
        <ul class="slide-points">${slide.points.map(p => `<li>${p}</li>`).join('')}</ul>
      </div>`;
    });

    html += '</body></html>';
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
      </Button>

      <h2 className="text-2xl font-bold mb-6">{t('presentationGenerator')}</h2>

      <div className="grid gap-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'عنوان العرض' : 'Presentation Title'}</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={lang === 'ar' ? 'أدخل عنوان العرض...' : 'Enter presentation title...'} />
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'عدد الشرائح' : 'Number of Slides'}</Label>
                <Input type="number" min={3} max={30} value={slideCount} onChange={e => setSlideCount(parseInt(e.target.value) || 10)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('researchLanguage')}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">{t('arabic')}</SelectItem>
                  <SelectItem value="en">{t('english')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{lang === 'ar' ? 'محتوى البحث أو النص' : 'Research content or text'}</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder={lang === 'ar' ? 'الصق محتوى البحث أو النص الذي تريد إنشاء عرض تقديمي منه...' : 'Paste your research content or text to generate a presentation from...'}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>

            <Button onClick={handleGenerate} disabled={loading || !title.trim() || !content.trim()} className="gap-2 w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
              {loading ? (lang === 'ar' ? 'جاري التوليد...' : 'Generating...') : (lang === 'ar' ? 'توليد العرض التقديمي' : 'Generate Presentation')}
            </Button>
          </CardContent>
        </Card>

        {slides.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{lang === 'ar' ? `العرض التقديمي (${slides.length} شريحة)` : `Presentation (${slides.length} slides)`}</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportAsPPTX} className="gap-1">
                  <FileDown className="h-3 w-3" /> PowerPoint
                </Button>
                <Button variant="outline" size="sm" onClick={exportAsHTML} className="gap-1">
                  <Download className="h-3 w-3" /> HTML
                </Button>
                <Button variant="outline" size="sm" onClick={printSlides} className="gap-1">
                  <Download className="h-3 w-3" /> PDF
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {slides.map((slide, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="bg-primary/5 px-4 py-2 border-b flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{lang === 'ar' ? `شريحة ${i + 1}` : `Slide ${i + 1}`}</span>
                  </div>
                  <CardContent className="pt-4 space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                    <h4 className="text-lg font-bold text-primary">{slide.title}</h4>
                    <ul className="space-y-1 list-disc list-inside">
                      {slide.points.map((point, j) => (
                        <li key={j} className="text-sm">{point}</li>
                      ))}
                    </ul>
                    {slide.notes && (
                      <p className="text-xs text-muted-foreground italic border-t pt-2">
                        {lang === 'ar' ? 'ملاحظات: ' : 'Notes: '}{slide.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PresentationGenerator;
