import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Languages, Copy, ArrowRightLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getAssistantProviderPayload } from '@/lib/assistant-provider';

const Translator = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('ar');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [translation, setTranslation] = useState('');

  const swapLanguages = () => {
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
    if (translation) {
      setText(translation);
      setTranslation('');
    }
  };

  const handleTranslate = async () => {
    if (!text.trim()) {
      toast({ title: lang === 'ar' ? 'يرجى إدخال النص' : 'Please enter text', variant: 'destructive' });
      return;
    }

    const { provider, apiKey } = getAssistantProviderPayload();
    if (!provider || !apiKey) {
      toast({
        title: lang === 'ar' ? 'لم يتم ضبط مزود الذكاء الاصطناعي' : 'AI provider not configured',
        description: lang === 'ar'
          ? 'يرجى إضافة مفتاح API لأحد المزودين من الإعدادات قبل استخدام الترجمة.'
          : 'Please add an API key for one of the providers in Settings before using translation.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setTranslation('');
    try {
      const sourceName = sourceLanguage === 'ar' ? 'Arabic' : 'English';
      const targetName = targetLanguage === 'ar' ? 'Arabic' : 'English';
      const systemPrompt = `You are an expert academic translator. Translate the following text from ${sourceName} to ${targetName} with high precision. Maintain academic tone, terminology accuracy, and proper formatting. Preserve paragraph structure. Output ONLY the translated text, nothing else (no preface, no explanation, no quotes).`;

      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: {
          provider,
          apiKey,
          systemPrompt,
          userPrompt: text.trim(),
          maxTokens: 8000,
          temperature: 0.2,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const out = (data?.content || '').trim();
      if (!out) throw new Error(lang === 'ar' ? 'لم يتم استلام ترجمة' : 'No translation returned');
      setTranslation(out);
    } catch (err: any) {
      toast({
        title: lang === 'ar' ? 'فشلت الترجمة' : 'Translation failed',
        description: err?.message || 'Error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(translation);
    toast({ title: lang === 'ar' ? 'تم النسخ!' : 'Copied!' });
  };

  const langName = (code: string) => code === 'ar' ? t('arabic') : t('english');

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
      </Button>

      <h2 className="text-2xl font-bold mb-6">{t('academicTranslation')}</h2>

      <div className="grid gap-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <Label className="text-sm text-muted-foreground">{lang === 'ar' ? 'من' : 'From'}</Label>
                <p className="font-semibold text-lg">{langName(sourceLanguage)}</p>
              </div>
              <Button variant="outline" size="icon" onClick={swapLanguages} className="rounded-full">
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <Label className="text-sm text-muted-foreground">{lang === 'ar' ? 'إلى' : 'To'}</Label>
                <p className="font-semibold text-lg">{langName(targetLanguage)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{lang === 'ar' ? 'النص المصدر' : 'Source Text'}</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder={lang === 'ar' ? 'الصق النص المراد ترجمته هنا...' : 'Paste the text to translate here...'}
                dir={sourceLanguage === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>

            <Button onClick={handleTranslate} disabled={loading || !text.trim()} className="gap-2 w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
              {loading ? (lang === 'ar' ? 'جاري الترجمة...' : 'Translating...') : (lang === 'ar' ? 'ترجمة' : 'Translate')}
            </Button>
          </CardContent>
        </Card>

        {translation && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{lang === 'ar' ? 'الترجمة' : 'Translation'}</CardTitle>
              <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1">
                <Copy className="h-3 w-3" /> {lang === 'ar' ? 'نسخ' : 'Copy'}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-md whitespace-pre-wrap generated-content" dir={targetLanguage === 'ar' ? 'rtl' : 'ltr'}>
                {translation}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Translator;
