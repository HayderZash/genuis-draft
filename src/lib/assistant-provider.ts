import { getMergeConfig, getProviderKey, type AIProvider } from '@/components/SettingsDialog';

export interface AssistantProviderPayload {
  provider?: AIProvider;
  apiKey?: string;
}

export const getAssistantProviderPayload = (): AssistantProviderPayload => {
  const mergeConfig = getMergeConfig();

  if (mergeConfig.enabled) {
    for (const provider of mergeConfig.providers) {
      const apiKey = getProviderKey(provider);
      if (apiKey) return { provider, apiKey };
    }
  }

  const provider = localStorage.getItem('ai_provider') as AIProvider | null;
  if (!provider) return {};

  const apiKey = getProviderKey(provider);
  return apiKey ? { provider, apiKey } : {};
};