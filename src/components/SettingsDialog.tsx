import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Layers } from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type AIProvider = 'openai' | 'gemini' | 'groq' | 'orbit' | 'openrouter' | 'siliconflow' | 'mistral';

export const ALL_PROVIDERS: { value: AIProvider; label: string; labelAr: string; placeholder: string }[] = [
  { value: 'openai', label: 'OpenAI', labelAr: 'OpenAI', placeholder: 'sk-...' },
  { value: 'gemini', label: 'Google Gemini', labelAr: 'Google Gemini', placeholder: 'AI...' },
  { value: 'groq', label: 'Groq Cloud', labelAr: 'Groq Cloud', placeholder: 'gsk_...' },
  { value: 'orbit', label: 'Orbit Provider', labelAr: 'Orbit Provider', placeholder: 'sk-orbit-...' },
  { value: 'openrouter', label: 'OpenRouter', labelAr: 'OpenRouter', placeholder: 'sk-or-...' },
  { value: 'siliconflow', label: 'SiliconFlow', labelAr: 'SiliconFlow', placeholder: 'sf-...' },
  { value: 'mistral', label: 'Mistral AI', labelAr: 'Mistral AI', placeholder: 'api-...' },
];

export const PROVIDER_KEY_MAP: Record<AIProvider, string> = {
  gemini: 'gemini_api_key',
  openai: 'openai_api_key',
  groq: 'groq_api_key',
  orbit: 'orbit_api_key',
  openrouter: 'openrouter_api_key',
  siliconflow: 'siliconflow_api_key',
  mistral: 'mistral_api_key',
};

export function getMergeConfig(): { enabled: boolean; providers: AIProvider[] } {
  const enabled = localStorage.getItem('ai_merge_mode') === 'true';
  const providers = JSON.parse(localStorage.getItem('ai_merge_providers') || '[]') as AIProvider[];
  return { enabled, providers };
}

export function getProviderKey(provider: AIProvider): string {
  return localStorage.getItem(PROVIDER_KEY_MAP[provider]) || '';
}

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  const { t, lang } = useLanguage();
  const isAr = lang === 'ar';

  // Single provider mode
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Merge mode
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeProviders, setMergeProviders] = useState<AIProvider[]>([]);
  const [mergeKeys, setMergeKeys] = useState<Record<AIProvider, string>>({} as any);
  const [showMergeKeys, setShowMergeKeys] = useState<Record<AIProvider, boolean>>({} as any);

  useEffect(() => {
    if (open) {
      const savedProvider = (localStorage.getItem('ai_provider') as AIProvider) || 'openai';
      setProvider(savedProvider);
      setApiKey(localStorage.getItem(PROVIDER_KEY_MAP[savedProvider]) || '');
      setShowKey(false);

      const merge = localStorage.getItem('ai_merge_mode') === 'true';
      setMergeMode(merge);
      setMergeProviders(JSON.parse(localStorage.getItem('ai_merge_providers') || '[]'));

      const keys: Record<string, string> = {};
      const shows: Record<string, boolean> = {};
      ALL_PROVIDERS.forEach(p => {
        keys[p.value] = localStorage.getItem(PROVIDER_KEY_MAP[p.value]) || '';
        shows[p.value] = false;
      });
      setMergeKeys(keys as any);
      setShowMergeKeys(shows as any);
    }
  }, [open]);

  const handleProviderChange = (val: AIProvider) => {
    setProvider(val);
    setApiKey(localStorage.getItem(PROVIDER_KEY_MAP[val]) || '');
    setShowKey(false);
  };

  const toggleMergeProvider = (p: AIProvider, checked: boolean) => {
    setMergeProviders(prev => checked ? [...prev, p] : prev.filter(x => x !== p));
  };

  const handleSave = () => {
    localStorage.setItem('ai_merge_mode', mergeMode ? 'true' : 'false');

    if (mergeMode) {
      localStorage.setItem('ai_merge_providers', JSON.stringify(mergeProviders));
      ALL_PROVIDERS.forEach(p => {
        if (mergeKeys[p.value]) {
          localStorage.setItem(PROVIDER_KEY_MAP[p.value], mergeKeys[p.value]);
        }
      });
    } else {
      localStorage.setItem('ai_provider', provider);
      localStorage.setItem(PROVIDER_KEY_MAP[provider], apiKey);
    }

    toast({ title: t('apiKeySaved') });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('settings')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Merge Mode Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">{isAr ? 'دمج المزودين' : 'Merge Providers'}</p>
                <p className="text-xs text-muted-foreground">
                  {isAr ? 'توليد متوازي من عدة مزودين ودمج النتائج' : 'Parallel generation from multiple providers and merge results'}
                </p>
              </div>
            </div>
            <Switch checked={mergeMode} onCheckedChange={setMergeMode} />
          </div>

          {mergeMode ? (
            /* Merge Mode: Show all providers */
            <div className="space-y-3">
              <Label>{isAr ? 'المزودون المفعلون' : 'Enabled Providers'}</Label>
              {ALL_PROVIDERS.map(p => {
                const isEnabled = mergeProviders.includes(p.value);
                return (
                  <div key={p.value} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`merge_${p.value}`}
                        checked={isEnabled}
                        onCheckedChange={(checked) => toggleMergeProvider(p.value, !!checked)}
                      />
                      <label htmlFor={`merge_${p.value}`} className="text-sm font-medium cursor-pointer">
                        {p.label}
                      </label>
                    </div>
                    {isEnabled && (
                      <div className="relative ms-6">
                        <Input
                          type={showMergeKeys[p.value] ? 'text' : 'password'}
                          value={mergeKeys[p.value] || ''}
                          onChange={(e) => setMergeKeys(prev => ({ ...prev, [p.value]: e.target.value }))}
                          placeholder={p.placeholder}
                          className="pe-10 text-sm"
                        />
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="absolute end-0 top-0 h-9 w-9"
                          onClick={() => setShowMergeKeys(prev => ({ ...prev, [p.value]: !prev[p.value] }))}
                        >
                          {showMergeKeys[p.value] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                {isAr ? 'سيتم إرسال الطلب لكل المزودين المفعلين بالتوازي ودمج النتائج في نص واحد متكامل.' : 'Requests will be sent to all enabled providers in parallel and results merged into one coherent text.'}
              </p>
            </div>
          ) : (
            /* Single Provider Mode */
            <>
              <div className="space-y-2">
                <Label>{t('aiProvider')}</Label>
                <Select value={provider} onValueChange={handleProviderChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
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
                    placeholder={ALL_PROVIDERS.find(p => p.value === provider)?.placeholder || ''}
                    className="pe-10"
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="absolute end-0 top-0 h-10 w-10"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave}>{t('save')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
