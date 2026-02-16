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

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  const { t } = useLanguage();
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (open) {
      const savedProvider = (localStorage.getItem('ai_provider') as 'openai' | 'gemini') || 'openai';
      setProvider(savedProvider);
      setApiKey(
        savedProvider === 'gemini'
          ? localStorage.getItem('gemini_api_key') || ''
          : localStorage.getItem('openai_api_key') || ''
      );
      setShowKey(false);
    }
  }, [open]);

  const handleProviderChange = (val: 'openai' | 'gemini') => {
    setProvider(val);
    setApiKey(
      val === 'gemini'
        ? localStorage.getItem('gemini_api_key') || ''
        : localStorage.getItem('openai_api_key') || ''
    );
    setShowKey(false);
  };

  const handleSave = () => {
    localStorage.setItem('ai_provider', provider);
    if (provider === 'gemini') {
      localStorage.setItem('gemini_api_key', apiKey);
    } else {
      localStorage.setItem('openai_api_key', apiKey);
    }
    toast({ title: t('apiKeySaved') });
    onOpenChange(false);
  };

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
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('apiKeyLabel')}</Label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === 'gemini' ? t('geminiApiKeyPlaceholder') : t('openaiApiKeyPlaceholder')}
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
