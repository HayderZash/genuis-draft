import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const FEATURE_COSTS: Record<string, number> = {
  research: 2,
  thesis: 5,
  reports: 1,
  cv: 0.5,
  proofreading: 0.5,
  translator: 0,
  summarizer: 0.25,
  exam_expert: 0.01,
};

// Helper: race a promise against a timeout that resolves to a sentinel
const withTimeout = <T,>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> =>
  new Promise<T>((resolve) => {
    let done = false;
    const t = window.setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
    Promise.resolve(p).then((v) => { if (!done) { done = true; window.clearTimeout(t); resolve(v); } })
      .catch(() => { if (!done) { done = true; window.clearTimeout(t); resolve(fallback); } });
  });

export const useFeatureAccess = () => {
  const { user } = useAuth();

  const checkAndConsume = async (feature: string, lang: string = 'ar'): Promise<boolean> => {
    if (!user) return false;
    const cost = FEATURE_COSTS[feature] ?? 0;

    // 1) Fetch profile + feature access with a hard 6s ceiling each.
    //    If they don't return in time, we FAIL-OPEN for unlimited-by-default UX
    //    so users are never blocked by slow backend reads.
    const profileRes = await withTimeout(
      supabase.from('profiles').select('account_type, is_active, expires_at').eq('user_id', user.id).maybeSingle(),
      6000,
      { data: null, error: null } as any,
    );
    const accessRes = await withTimeout(
      supabase.from('user_feature_access').select('is_enabled').eq('user_id', user.id).eq('feature', feature).maybeSingle(),
      6000,
      { data: null, error: null } as any,
    );

    const profile = profileRes?.data;
    const access = accessRes?.data;

    // Profile load failed or timed out -> allow (don't block the user)
    if (!profile) return true;

    if (profile.is_active === false) {
      toast({ title: lang === 'ar' ? 'تم تعطيل حسابك. تواصل مع المدير.' : 'Your account is disabled.', variant: 'destructive' });
      return false;
    }

    if (profile.expires_at && new Date(profile.expires_at) < new Date()) {
      toast({ title: lang === 'ar' ? 'انتهت صلاحية حسابك. تواصل مع المدير.' : 'Your account has expired.', variant: 'destructive' });
      return false;
    }

    if (access && access.is_enabled === false) {
      toast({ title: lang === 'ar' ? 'هذه الميزة غير متاحة لحسابك' : 'This feature is unavailable for your account', variant: 'destructive' });
      return false;
    }

    // Unlimited account or zero-cost feature -> allow without invoking edge function
    if (profile.account_type !== 'points' || cost === 0) return true;

    // Points account -> consume via edge function (with timeout fail-open to keep UX smooth)
    const consume = await withTimeout(
      supabase.functions.invoke('admin-users', { body: { action: 'consume-points', userId: user.id, feature, cost } }),
      8000,
      { data: null, error: null } as any,
    );

    if (consume?.error) return true; // network failure -> don't block
    if (consume?.data?.allowed === false) {
      const code = consume.data.error;
      const msg = lang === 'ar'
        ? (code === 'Feature disabled' ? 'هذه الميزة غير متاحة لحسابك' :
           code === 'Points expired' ? 'انتهت صلاحية النقاط' :
           code === 'Insufficient points' ? 'رصيد النقاط غير كافٍ' :
           'لا يمكن استخدام هذه الميزة')
        : code || 'Cannot use this feature';
      toast({ title: msg, variant: 'destructive' });
      return false;
    }
    return true;
  };

  return { checkAndConsume };
};
