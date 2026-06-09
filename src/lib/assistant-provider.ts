import { getMergeConfig, getProviderKey, type AIProvider } from '@/components/SettingsDialog';
import { getCachedPlatformSettings } from '@/hooks/usePlatformSettings';

export interface AssistantProviderPayload {
  provider?: AIProvider;
  apiKey?: string;
}

export const getAssistantProviderPayload = (): AssistantProviderPayload => {
  // 1) User's own merge config
  const mergeConfig = getMergeConfig();
  if (mergeConfig.enabled && mergeConfig.providers.length > 0) {
    for (const provider of mergeConfig.providers) {
      const apiKey = getProviderKey(provider);
      if (apiKey) return { provider, apiKey };
    }
  }

  // 2) User's own single provider
  const userProvider = localStorage.getItem('ai_provider') as AIProvider | null;
  if (userProvider) {
    const apiKey = getProviderKey(userProvider);
    if (apiKey) return { provider: userProvider, apiKey };
  }

  // 3) Admin default keys (for free accounts or users without keys)
  const defaults = getCachedPlatformSettings();
  if (defaults.default_merge_enabled === 'true') {
    try {
      const providers: AIProvider[] = JSON.parse(defaults.default_merge_providers || '[]');
      for (const provider of providers) {
        const keyMap: Record<string, string> = {
          openai: 'default_key_openai',
          gemini: 'default_key_gemini',
          gemini_pro: 'default_key_gemini_pro',
          groq: 'default_key_groq',
          deepseek_chat: 'default_key_deepseek_chat',
          deepseek_reasoner: 'default_key_deepseek_reasoner',
          mistral: 'default_key_mistral',
          cohere_command_vision: 'default_key_cohere',
          openrouter: 'default_key_openrouter',
          siliconflow: 'default_key_siliconflow',
          orbit: 'default_key_orbit',
        };
        const key = (defaults as any)[keyMap[provider]];
        if (key) return { provider, apiKey: key };
      }
    } catch {}
  }

  if (defaults.default_ai_provider && defaults.default_ai_api_key) {
    return {
      provider: defaults.default_ai_provider as AIProvider,
      apiKey: defaults.default_ai_api_key,
    };
  }

  return {};
};
