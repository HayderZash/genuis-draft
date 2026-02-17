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
import { ArrowLeft, Loader2, ShieldCheck, AlertTriangle, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PlagiarismResult {
  originality_score: number;
  analysis: string;
  suspicious_phrases: string[];
  recommendations: string[];
}

const PlagiarismChecker = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<string>('ar');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<PlagiarismResult | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'txt' || ext === 'md') {
      const content = await file.text();
      setText(content);
      return;
    }

    // For PDF/DOCX, we read as text (basic extraction)
    if (ext === 'pdf' || ext === 'docx' || ext === 'doc') {
      setUploading(true);
      try {
        const content = await file.text();
        // Try to extract readable text
        const cleaned = content.replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FFa-zA-Z0-9\s.,;:!?()[\]{}\-'"]/g, ' ')
          .replace(/\s+/g, ' ').trim();
        if (cleaned.length > 50) {
          setText(cleaned);
        } else {
          toast({ title: lang === 'ar' ? 'لم نتمكن من استخراج النص. يرجى لصق النص يدوياً' : 'Could not extract text. Please paste it manually.', variant: 'destructive' });
        }
      } catch {
        toast({ title: lang === 'ar' ? 'خطأ في قراءة الملف' : 'Error reading file', variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    } else {
      toast({ title: lang === 'ar' ? 'يرجى رفع ملف TXT أو PDF أو Word' : 'Please upload a TXT, PDF, or Word file', variant: 'destructive' });
    }
    e.target.value = '';
  };

  const handleCheck = async () => {
    if (!text.trim()) {
      toast({ title: lang === 'ar' ? 'يرجى إدخال النص' : 'Please enter text', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('plagiarism-check', {
        body: { text: text.trim(), language },
      });
      if (error) throw error;
      const resultText = data?.result || '';
      let parsed: PlagiarismResult;
      try {
        const jsonMatch = resultText.match(/```json?\s*([\s\S]*?)```/) || resultText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : resultText;
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = { originality_score: 0, analysis: resultText, suspicious_phrases: [], recommendations: [] };
      }
      setResult(parsed);
    } catch (err: any) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-destructive';
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
      </Button>

      <h2 className="text-2xl font-bold mb-6">{t('plagiarismChecker')}</h2>

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
              <Label>{lang === 'ar' ? 'النص المراد فحصه' : 'Text to check'}</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder={lang === 'ar' ? 'الصق النص المراد فحصه هنا أو ارفع ملف...' : 'Paste the text to check here or upload a file...'}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleCheck} disabled={loading || uploading || !text.trim()} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {loading ? (lang === 'ar' ? 'جاري الفحص...' : 'Checking...') : (lang === 'ar' ? 'فحص النص' : 'Check Text')}
              </Button>
              <Button variant="outline" className="gap-2 relative" disabled={uploading}>
                <Upload className="h-4 w-4" />
                {uploading ? (lang === 'ar' ? 'جاري القراءة...' : 'Reading...') : (lang === 'ar' ? 'رفع ملف' : 'Upload File')}
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{lang === 'ar' ? 'نتيجة الفحص' : 'Check Result'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className={`text-5xl font-bold ${scoreColor(result.originality_score)}`}>
                    {result.originality_score}%
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {lang === 'ar' ? 'نسبة الأصالة' : 'Originality Score'}
                  </p>
                  <Progress value={result.originality_score} className="mt-3 h-3" />
                </div>

                <div className="p-4 bg-muted rounded-md generated-content" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <p className="font-semibold mb-2">{lang === 'ar' ? 'التحليل:' : 'Analysis:'}</p>
                  <p className="whitespace-pre-wrap">{result.analysis}</p>
                </div>
              </CardContent>
            </Card>

            {result.suspicious_phrases && result.suspicious_phrases.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    {lang === 'ar' ? 'عبارات مشبوهة' : 'Suspicious Phrases'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                    {result.suspicious_phrases.map((phrase, i) => (
                      <div key={i} className="p-3 border rounded-md bg-amber-50 text-sm">
                        "{phrase}"
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {result.recommendations && result.recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{lang === 'ar' ? 'توصيات' : 'Recommendations'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 list-disc list-inside" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm">{rec}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PlagiarismChecker;
