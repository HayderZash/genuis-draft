import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUserSettings = () => {
  const { user } = useAuth();

  const loadSettings = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {};
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_key, setting_value')
        .eq('user_id', user.id);
      if (error) throw error;
      const settings: Record<string, string> = {};
      (data || []).forEach(row => { settings[row.setting_key] = row.setting_value; });
      return settings;
    } catch {
      return {};
    }
  }, [user]);

  const saveSetting = useCallback(async (key: string, value: string) => {
    if (!user) {
      localStorage.setItem(key, value);
      return;
    }
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          { user_id: user.id, setting_key: key, setting_value: value },
          { onConflict: 'user_id,setting_key' }
        );
      if (error) throw error;
      // Also keep localStorage as cache
      localStorage.setItem(key, value);
    } catch {
      localStorage.setItem(key, value);
    }
  }, [user]);

  const saveMultipleSettings = useCallback(async (settings: Record<string, string>) => {
    if (!user) {
      Object.entries(settings).forEach(([k, v]) => localStorage.setItem(k, v));
      return;
    }
    try {
      const rows = Object.entries(settings).map(([k, v]) => ({
        user_id: user.id,
        setting_key: k,
        setting_value: v,
      }));
      const { error } = await supabase
        .from('user_settings')
        .upsert(rows, { onConflict: 'user_id,setting_key' });
      if (error) throw error;
      Object.entries(settings).forEach(([k, v]) => localStorage.setItem(k, v));
    } catch {
      Object.entries(settings).forEach(([k, v]) => localStorage.setItem(k, v));
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
