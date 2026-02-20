import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type AIProvider = 'openai' | 'gemini' | 'groq' | 'orbit';

const PROVIDER_KEY_MAP: Record<AIProvider, string> = {
  gemini: 'gemini_api_key',
  openai: 'openai_api_key',
  groq: 'groq_api_key',
  orbit: 'orbit_api_key',
};

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  const { t, lang } = useLanguage();
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const isAr = lang === 'ar';

  useEffect(() => {
    if (open) {
      const savedProvider = (localStorage.getItem('ai_provider') as AIProvider) || 'openai';
      setProvider(savedProvider);
      setApiKey(localStorage.getItem(PROVIDER_KEY_MAP[savedProvider]) || '');
      setShowKey(false);
    }
  }, [open]);

  const handleProviderChange = (val: AIProvider) => {
    setProvider(val);
    setApiKey(localStorage.getItem(PROVIDER_KEY_MAP[val]) || '');
    setShowKey(false);
  };

  const handleSave = () => {
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem(PROVIDER_KEY_MAP[provider], apiKey);
    toast({ title: t('apiKeySaved') });
    onOpenChange(false);
  };

  const placeholder = provider === 'groq' ? 'gsk_...'
    : provider === 'gemini' ? t('geminiApiKeyPlaceholder')
    : provider === 'orbit' ? 'orb_...'
    : t('openaiApiKeyPlaceholder');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('aiProvider')}</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="groq">Groq Cloud</SelectItem>
                <SelectItem value="orbit">Orbit Provider</SelectItem>
              </SelectContent>
            </Select>
            {provider === 'orbit' && (
              <p className="text-xs text-muted-foreground">
                {isAr ? 'يوفر Claude Opus 4.6 و Gemini 3.0 Pro بسعر أقل 70%' : 'Provides Claude Opus 4.6 & Gemini 3.0 Pro at 70% less cost'}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('apiKeyLabel')}</Label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={placeholder}
                className="pe-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute end-0 top-0 h-10 w-10"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave}>{t('save')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
