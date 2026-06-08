import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, BookOpen, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useUserPlan } from '@/hooks/useUserPlan';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

const Summarizer = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { checkAndConsume } = useFeatureAccess();
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<string>('ar');
  const [targetLength, setTargetLength] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');

  const handleSummarize = async () => {
    if (!text.trim()) {
      toast({ title: lang === 'ar' ? 'يرجى إدخال النص' : 'Please enter text', variant: 'destructive' });
      return;
    }
    const allowed = await checkAndConsume('summarizer', lang);
    if (!allowed) return;
    setLoading(true);
    setSummary('');
    try {
      const { data, error } = await supabase.functions.invoke('summarize', {
        body: { text: text.trim(), language, targetLength },
      });
      if (error) throw error;
      setSummary(data?.summary || '');
    } catch (err: any) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary);
    toast({ title: lang === 'ar' ? 'تم النسخ!' : 'Copied!' });
  };

  const lengthLabels: Record<string, { ar: string; en: string }> = {
    short: { ar: 'قصير', en: 'Short' },
    medium: { ar: 'متوسط', en: 'Medium' },
    long: { ar: 'مفصّل', en: 'Detailed' },
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
      </Button>

      <h2 className="text-2xl font-bold mb-6">{t('summarizeText')}</h2>

      <div className="grid gap-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('researchLanguage')}</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">{t('arabic')}</SelectItem>
                    <SelectItem value="en">{t('english')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'طول الملخص' : 'Summary Length'}</Label>
                <Select value={targetLength} onValueChange={setTargetLength}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(lengthLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v[lang]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{lang === 'ar' ? 'النص المراد تلخيصه' : 'Text to summarize'}</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder={lang === 'ar' ? 'الصق النص المراد تلخيصه هنا...' : 'Paste the text to summarize here...'}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>

            <Button onClick={handleSummarize} disabled={loading || !text.trim()} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
              {loading ? (lang === 'ar' ? 'جاري التلخيص...' : 'Summarizing...') : (lang === 'ar' ? 'تلخيص النص' : 'Summarize')}
            </Button>
          </CardContent>
        </Card>

        {summary && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{lang === 'ar' ? 'الملخص' : 'Summary'}</CardTitle>
              <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1">
                <Copy className="h-3 w-3" /> {lang === 'ar' ? 'نسخ' : 'Copy'}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-md whitespace-pre-wrap generated-content" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                {summary}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Summarizer;
