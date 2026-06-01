import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { withRetry } from '@/lib/retry';

export const useUserSettings = () => {
  const { user } = useAuth();

  const loadSettings = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {};
    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('user_settings')
          .select('setting_key, setting_value')
          .eq('user_id', user.id);
        if (error) throw error;
        return data || [];
      }, { retries: 2, timeoutMs: 6000 });
      const settings: Record<string, string> = {};
      data.forEach((row: any) => { settings[row.setting_key] = row.setting_value; });
      return settings;
    } catch {
      return {};
    }
  }, [user]);

  const saveSetting = useCallback(async (key: string, value: string) => {
    // Always update local cache first
    localStorage.setItem(key, value);
    if (!user) return;
    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('user_settings')
          .upsert(
            { user_id: user.id, setting_key: key, setting_value: value },
            { onConflict: 'user_id,setting_key' }
          );
        if (error) throw error;
      }, { retries: 3, baseMs: 500, timeoutMs: 8000 });
    } catch {
      // Local cache already has it; will sync on next save
    }
  }, [user]);

  const saveMultipleSettings = useCallback(async (settings: Record<string, string>) => {
    // Local cache first (optimistic)
    Object.entries(settings).forEach(([k, v]) => localStorage.setItem(k, v));
    if (!user) return;
    try {
      const rows = Object.entries(settings).map(([k, v]) => ({
        user_id: user.id,
        setting_key: k,
        setting_value: v,
      }));
      await withRetry(async () => {
        const { error } = await supabase
          .from('user_settings')
          .upsert(rows, { onConflict: 'user_id,setting_key' });
        if (error) throw error;
      }, { retries: 3, baseMs: 500, timeoutMs: 10000 });
    } catch {
      // Local cache still has values
    }
  }, [user]);

  const syncToLocal = useCallback(async () => {
    const settings = await loadSettings();
    Object.entries(settings).forEach(([k, v]) => {
      if (v) localStorage.setItem(k, v);
    });
    return settings;
  }, [loadSettings]);

  return { loadSettings, saveSetting, saveMultipleSettings, syncToLocal };
};
