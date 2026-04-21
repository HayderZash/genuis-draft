import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Upload, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

interface Correction { original: string; corrected: string; type: string; }
interface Plagiarism {
  score: number;
  verdict: string;
  suspicious_phrases: string[];
  notes: string;
}
interface ResultShape {
  corrected: string;
  corrections: Correction[];
  plagiarism?: Plagiarism;
}

const Proofreading = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { checkAndConsume } = useFeatureAccess();
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<string>('ar');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultShape | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.txt')) {
      setText(await file.text());
    } else {
      toast({ title: lang === 'ar' ? 'يرجى نسخ النص ولصقه أدناه' : 'Please copy and paste the text below' });
    }
  };

  const handleRun = async () => {
    if (!text.trim()) {
      toast({ title: lang === 'ar' ? 'يرجى إدخال النص' : 'Please enter text', variant: 'destructive' });
      return;
    }
    const allowed = await checkAndConsume('proofreading', lang);
    if (!allowed) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('proofread', {
        body: { text: text.trim(), language, mode: 'both' },
      });
      if (error) throw error;
      const resultText = data?.result || '';
      let parsed: ResultShape;
      try {
        const jsonMatch = resultText.match(/```json?\s*([\s\S]*?)```/) || resultText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : resultText;
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = { corrected: resultText, corrections: [] };
      }
      setResult(parsed);
    } catch (err: any) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const verdictColor = (verdict: string, score: number) => {
    if (score >= 60) return 'destructive';
    if (score >= 30) return 'secondary';
    return 'default';
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-primary/10"><ShieldCheck className="h-6 w-6 text-primary" /></div>
        <div>
          <h2 className="text-2xl font-bold">{lang === 'ar' ? 'التدقيق والكشف الأكاديمي' : 'Academic Proofreading & Plagiarism'}</h2>
          <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'تدقيق لغوي + كشف نسبة الاستلال في طلب واحد' : 'Linguistic proofreading + plagiarism detection in one request'}</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
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
              <Label>{lang === 'ar' ? 'رفع ملف نصي' : 'Upload .txt'}</Label>
              <label className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted transition-colors w-fit">
                <Upload className="h-4 w-4" />
                <span className="text-sm">{lang === 'ar' ? 'اختر ملفاً' : 'Choose file'}</span>
                <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            <div className="space-y-2">
              <Label>{lang === 'ar' ? 'الصق النص' : 'Paste text'}</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder={lang === 'ar' ? 'الصق النص هنا...' : 'Paste text here...'}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>

            <Button onClick={handleRun} disabled={loading || !text.trim()} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {loading ? (lang === 'ar' ? 'جاري التحليل...' : 'Analyzing...') : (lang === 'ar' ? 'بدء التدقيق والكشف' : 'Start Proofreading & Detection')}
            </Button>
          </CardContent>
        </Card>

        {result?.plagiarism && (
          <Card>
            <CardHeader><CardTitle>{lang === 'ar' ? 'نتيجة كشف الاستلال' : 'Plagiarism Detection'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{lang === 'ar' ? 'نسبة الاستلال التقديرية' : 'Estimated Plagiarism'}</span>
                <Badge variant={verdictColor(result.plagiarism.verdict, result.plagiarism.score) as any}>
                  {result.plagiarism.score}% • {result.plagiarism.verdict}
                </Badge>
              </div>
              <Progress value={result.plagiarism.score} />
              {result.plagiarism.notes && (
                <p className="text-sm text-muted-foreground">{result.plagiarism.notes}</p>
              )}
              {result.plagiarism.suspicious_phrases?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{lang === 'ar' ? 'عبارات مشتبه بها' : 'Suspicious phrases'}</p>
                  <ul className="space-y-1">
                    {result.plagiarism.suspicious_phrases.map((p, i) => (
                      <li key={i} className="text-sm p-2 bg-muted rounded">{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <Card>
              <CardHeader><CardTitle>{t('correctedText')}</CardTitle></CardHeader>
              <CardContent>
                <div className="p-4 bg-muted rounded-md whitespace-pre-wrap generated-content" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  {result.corrected}
                </div>
              </CardContent>
            </Card>

            {result.corrections && result.corrections.length > 0 && (
              <Card>
                <CardHeader><CardTitle>{t('corrections')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.corrections.map((c, i) => (
                      <div key={i} className="flex flex-col gap-1 p-3 border rounded-md">
                        <Badge variant="outline" className="w-fit">{c.type}</Badge>
                        <div className="text-sm">
                          <span className="line-through text-destructive">{c.original}</span>
                          {' → '}
                          <span className="text-emerald-600 font-medium">{c.corrected}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Proofreading;
