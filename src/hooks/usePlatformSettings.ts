import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeRetry } from '@/lib/retry';

export interface PlatformSettings {
  contact_whatsapp: string;
  contact_telegram: string;
  contact_email: string;
  plan_free_max_research: number;
  plan_free_max_pages_per_chapter: number;
  plan_free_report_pages: number;
  plan_free_exam_questions: number;
  plan_free_summary_chars: number;
  plan_5k_points: number;
  plan_5k_price: number;
  plan_10k_points: number;
  plan_10k_price: number;
  plan_25k_points: number;
  plan_25k_price: number;
  plan_unlimited_price: number;
  cost_research: number;
  cost_thesis: number;
  cost_report: number;
  cost_exam: number;
  cost_cv: number;
  cost_proofread: number;
  cost_summarize: number;
  cost_translate: number;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  contact_whatsapp: '07862403284',
  contact_telegram: 'HayderZash',
  contact_email: 'hayderpailot@gmail.com',
  plan_free_max_research: 1,
  plan_free_max_pages_per_chapter: 3,
  plan_free_report_pages: 5,
  plan_free_exam_questions: 5,
  plan_free_summary_chars: 1000,
  plan_5k_points: 8,
  plan_5k_price: 5000,
  plan_10k_points: 20,
  plan_10k_price: 10000,
  plan_25k_points: 50,
  plan_25k_price: 25000,
  plan_unlimited_price: 50000,
  cost_research: 5,
  cost_thesis: 5,
  cost_report: 3,
  cost_exam: 3,
  cost_cv: 2,
  cost_proofread: 0,
  cost_summarize: 0,
  cost_translate: 0,
};

const CACHE_KEY = 'platform_settings_cache_v1';

const parseSettings = (rows: { key: string; value: string }[]): PlatformSettings => {
  const map: Record<string, string> = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  const out: any = { ...DEFAULT_PLATFORM_SETTINGS };
  Object.keys(DEFAULT_PLATFORM_SETTINGS).forEach((k) => {
    if (map[k] === undefined) return;
    const def = (DEFAULT_PLATFORM_SETTINGS as any)[k];
    if (typeof def === 'number') {
      const n = parseFloat(map[k]);
      out[k] = isNaN(n) ? def : n;
    } else {
      out[k] = map[k];
    }
  });
  return out as PlatformSettings;
};

export const usePlatformSettings = () => {
  const [settings, setSettings] = useState<PlatformSettings>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return { ...DEFAULT_PLATFORM_SETTINGS, ...JSON.parse(cached) };
    } catch {}
    return DEFAULT_PLATFORM_SETTINGS;
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await safeRetry(
      async () => {
        const { data, error } = await supabase.from('platform_settings').select('key, value');
        if (error) throw error;
        return data || [];
      },
      [] as any[],
      { retries: 2, timeoutMs: 6000 },
    );
    if (data && data.length) {
      const parsed = parseSettings(data);
      setSettings(parsed);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(parsed)); } catch {}
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { settings, loading, refresh };
};
