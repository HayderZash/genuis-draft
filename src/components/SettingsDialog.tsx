import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserSettings } from '@/hooks/useUserSettings';
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

export type AIProvider =
  | 'openai'
  | 'gemini'
  | 'gemini_pro'
  | 'groq'
  | 'orbit'
  | 'openrouter'
  | 'siliconflow'
  | 'mistral'
  | 'mistral_medium'
  | 'codestral'
  | 'devstral'
  | 'deepseek_chat'
  | 'deepseek_reasoner'
  | 'cohere_command_vision'
  | 'cohere_rerank'
  | 'cohere_embed'
  | 'dalle3';

export const ALL_PROVIDERS: { value: AIProvider; label: string; labelAr: string; placeholder: string; group?: string }[] = [
  // OpenAI family
  { value: 'openai', label: 'OpenAI (GPT-4o-mini)', labelAr: 'OpenAI (GPT-4o-mini)', placeholder: 'sk-...', group: 'OpenAI' },
  { value: 'dalle3', label: 'OpenAI (DALL·E 3 — Image)', labelAr: 'OpenAI DALL·E 3 (صور)', placeholder: 'sk-...', group: 'OpenAI' },
  // Google
  { value: 'gemini', label: 'Google Gemini 2.5 Flash', labelAr: 'Google Gemini 2.5 Flash', placeholder: 'AI...', group: 'Google' },
  { value: 'gemini_pro', label: 'Google Gemini 2.5 Pro', labelAr: 'Google Gemini 2.5 Pro', placeholder: 'AI...', group: 'Google' },
  // DeepSeek
  { value: 'deepseek_chat', label: 'DeepSeek Chat', labelAr: 'DeepSeek Chat', placeholder: 'sk-...', group: 'DeepSeek' },
  { value: 'deepseek_reasoner', label: 'DeepSeek Reasoner', labelAr: 'DeepSeek Reasoner', placeholder: 'sk-...', group: 'DeepSeek' },
  // Mistral family
  { value: 'mistral', label: 'Mistral Large', labelAr: 'Mistral Large', placeholder: 'api-...', group: 'Mistral' },
  { value: 'mistral_medium', label: 'Mistral Medium Latest', labelAr: 'Mistral Medium', placeholder: 'api-...', group: 'Mistral' },
  { value: 'codestral', label: 'Codestral Latest', labelAr: 'Codestral Latest', placeholder: 'api-...', group: 'Mistral' },
  { value: 'devstral', label: 'Devstral Latest', labelAr: 'Devstral Latest', placeholder: 'api-...', group: 'Mistral' },
  // Cohere family
  { value: 'cohere_command_vision', label: 'Cohere Command-A Vision', labelAr: 'Cohere Command Vision', placeholder: 'co-...', group: 'Cohere' },
  { value: 'cohere_rerank', label: 'Cohere Rerank v4 (Pro)', labelAr: 'Cohere Rerank v4', placeholder: 'co-...', group: 'Cohere' },
  { value: 'cohere_embed', label: 'Cohere Embed English v3', labelAr: 'Cohere Embed v3', placeholder: 'co-...', group: 'Cohere' },
  // Others
  { value: 'groq', label: 'Groq Cloud (Llama 3.3)', labelAr: 'Groq Cloud', placeholder: 'gsk_...', group: 'Other' },
  { value: 'orbit', label: 'Orbit Provider', labelAr: 'Orbit Provider', placeholder: 'sk-orbit-...', group: 'Other' },
  { value: 'openrouter', label: 'OpenRouter', labelAr: 'OpenRouter', placeholder: 'sk-or-...', group: 'Other' },
  { value: 'siliconflow', label: 'SiliconFlow', labelAr: 'SiliconFlow', placeholder: 'sf-...', group: 'Other' },
];

export const PROVIDER_KEY_MAP: Record<AIProvider, string> = {
  gemini: 'gemini_api_key',
  gemini_pro: 'gemini_pro_api_key',
  openai: 'openai_api_key',
  dalle3: 'dalle3_api_key',
  groq: 'groq_api_key',
  orbit: 'orbit_api_key',
  openrouter: 'openrouter_api_key',
  siliconflow: 'siliconflow_api_key',
  mistral: 'mistral_api_key',
  mistral_medium: 'mistral_medium_api_key',
  codestral: 'codestral_api_key',
  devstral: 'devstral_api_key',
  deepseek_chat: 'deepseek_chat_api_key',
  deepseek_reasoner: 'deepseek_reasoner_api_key',
  cohere_command_vision: 'cohere_command_vision_api_key',
  cohere_rerank: 'cohere_rerank_api_key',
  cohere_embed: 'cohere_embed_api_key',
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
  const { saveMultipleSettings, syncToLocal } = useUserSettings();

  const [provider, setProvider] = useState<AIProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [mergeMode, setMergeMode] = useState(false);
  const [mergeProviders, setMergeProviders] = useState<AIProvider[]>([]);
  const [mergeKeys, setMergeKeys] = useState<Record<AIProvider, string>>({} as any);
  const [showMergeKeys, setShowMergeKeys] = useState<Record<AIProvider, boolean>>({} as any);

  // Load only ONCE when dialog opens; do NOT depend on syncToLocal (it changes every render and causes a reset loop that wipes typed input).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      try { await syncToLocal(); } catch { /* ignore — fall back to localStorage */ }
      if (cancelled) return;
      const savedProvider = (localStorage.getItem('ai_provider') as AIProvider) || 'openai';
      setProvider(savedProvider);
      setApiKey(localStorage.getItem(PROVIDER_KEY_MAP[savedProvider]) || '');
      setShowKey(false);
      setMergeMode(localStorage.getItem('ai_merge_mode') === 'true');
      setMergeProviders(JSON.parse(localStorage.getItem('ai_merge_providers') || '[]'));
      const keys: Record<string, string> = {};
      const shows: Record<string, boolean> = {};
      ALL_PROVIDERS.forEach(p => {
        keys[p.value] = localStorage.getItem(PROVIDER_KEY_MAP[p.value]) || '';
        shows[p.value] = false;
      });
      setMergeKeys(keys as any);
      setShowMergeKeys(shows as any);
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleProviderChange = (val: AIProvider) => {
    setProvider(val);
    setApiKey(localStorage.getItem(PROVIDER_KEY_MAP[val]) || '');
    setShowKey(false);
  };

  const toggleMergeProvider = (p: AIProvider, checked: boolean) => {
    setMergeProviders(prev => checked ? [...prev, p] : prev.filter(x => x !== p));
  };

  const handleSave = async () => {
    const settings: Record<string, string> = {
      ai_merge_mode: mergeMode ? 'true' : 'false',
    };
    if (mergeMode) {
      settings.ai_merge_providers = JSON.stringify(mergeProviders);
      ALL_PROVIDERS.forEach(p => {
        if (mergeKeys[p.value]) settings[PROVIDER_KEY_MAP[p.value]] = mergeKeys[p.value];
      });
    } else {
      settings.ai_provider = provider;
      settings[PROVIDER_KEY_MAP[provider]] = apiKey;
    }
    await saveMultipleSettings(settings);
    toast({ title: t('apiKeySaved') });
    onOpenChange(false);
  };

  // Group providers
  const groupedProviders = ALL_PROVIDERS.reduce((acc, p) => {
    const g = p.group || 'Other';
    if (!acc[g]) acc[g] = [];
    acc[g].push(p);
    return acc;
  }, {} as Record<string, typeof ALL_PROVIDERS>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('settings')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
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
            <div className="space-y-3">
              <Label>{isAr ? 'المزودون المفعلون' : 'Enabled Providers'}</Label>
              {Object.entries(groupedProviders).map(([groupName, providers]) => (
                <div key={groupName} className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide pt-1">{groupName}</p>
                  {providers.map(p => {
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
                            {isAr ? p.labelAr : p.label}
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
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {isAr ? 'سيتم إرسال الطلب لكل المزودين المفعلين بالتوازي ودمج النتائج في نص واحد متكامل.' : 'Requests will be sent to all enabled providers in parallel and results merged into one coherent text.'}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{t('aiProvider')}</Label>
                <Select value={provider} onValueChange={handleProviderChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(groupedProviders).map(([groupName, providers]) => (
                      <div key={groupName}>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-2 py-1">{groupName}</p>
                        {providers.map(p => (
                          <SelectItem key={p.value} value={p.value}>{isAr ? p.labelAr : p.label}</SelectItem>
                        ))}
                      </div>
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
