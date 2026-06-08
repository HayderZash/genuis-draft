import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AccountType = 'free' | 'unlimited' | 'points';

const CACHE_PREFIX = 'user_plan_cache_';

export const useUserPlan = () => {
  const { user } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>(() => {
    if (!user) return 'unlimited';
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + user.id);
      if (cached) return cached as AccountType;
    } catch {}
    return 'unlimited';
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let aborted = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('user_id', user.id)
          .maybeSingle();
        if (aborted) return;
        const t = (data?.account_type as AccountType) || 'unlimited';
        setAccountType(t);
        try { localStorage.setItem(CACHE_PREFIX + user.id, t); } catch {}
      } catch {
        // silent — keep cached
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [user?.id]);

  return { accountType, isFree: accountType === 'free', loading };
};
