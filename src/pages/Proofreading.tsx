import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload, Loader2, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Correction {
  original: string;
  corrected: string;
  type: string;
}

const Proofreading = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<string>('ar');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ corrected: string; corrections: Correction[] } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For text extraction we read as text for .txt, otherwise notify user
    if (file.name.endsWith('.txt')) {
      const content = await file.text();
      setText(content);
    } else {
      toast({ title: lang === 'ar' ? 'يرجى نسخ النص من الملف ولصقه في الحقل أدناه' : 'Please copy text from the file and paste it below' });
    }
  };

  const handleProofread = async () => {
    if (!text.trim()) {
      toast({ title: lang === 'ar' ? 'يرجى إدخال النص' : 'Please enter text', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('proofread', {
        body: { text: text.trim(), language },
      });
      if (error) throw error;
      const resultText = data?.result || '';
      // Try to parse JSON from the result
      let parsed;
      try {
        // Try extracting JSON from markdown code block
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

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
      </Button>

      <h2 className="text-2xl font-bold mb-6">{t('proofreading')}</h2>

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
              <Label>{t('uploadForProofreading')}</Label>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted transition-colors">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">{t('uploadFile')}</span>
                  <input type="file" accept=".txt,.pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('pasteText')}</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder={lang === 'ar' ? 'الصق النص المراد تدقيقه هنا...' : 'Paste the text to proofread here...'}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>

            <Button onClick={handleProofread} disabled={loading || !text.trim()} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {loading ? t('proofreadingInProgress') : t('startProofreading')}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <>
            <Card>
              <CardHeader><CardTitle>{t('correctedText')}</CardTitle></CardHeader>
              <CardContent>
                <div className="p-4 bg-muted rounded-md whitespace-pre-wrap" dir={language === 'ar' ? 'rtl' : 'ltr'}>
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
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline">{c.type}</Badge>
                        </div>
                        <div className="text-sm">
                          <span className="line-through text-destructive">{c.original}</span>
                          {' → '}
                          <span className="text-green-600 font-medium">{c.corrected}</span>
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
