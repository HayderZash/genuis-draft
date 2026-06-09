import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { safeRetry, withTimeout } from '@/lib/retry';
import { DEFAULT_PLATFORM_SETTINGS, getCachedPlatformSettings } from '@/hooks/usePlatformSettings';
import { isAdminCached } from '@/hooks/useUserRole';

// Map UI feature keys -> point cost keys in platform_settings
const COST_KEY_MAP: Record<string, keyof typeof DEFAULT_PLATFORM_SETTINGS> = {
  research: 'cost_research',
  thesis: 'cost_thesis',
  reports: 'cost_report',
  report: 'cost_report',
  cv: 'cost_cv',
  proofreading: 'cost_proofread',
  exam_expert: 'cost_exam',
  summarizer: 'cost_summarize',
  translator: 'cost_translate',
};

// Features that are completely LOCKED on the free plan
const FREE_LOCKED = new Set(['thesis', 'proofreading', 'cv']);

const getCachedSettings = getCachedPlatformSettings;

const getCost = (feature: string): number => {
  const key = COST_KEY_MAP[feature];
  if (!key) return 0;
  const settings = getCachedSettings();
  return Number(settings[key]) || 0;
};

export const useFeatureAccess = () => {
  const { user } = useAuth();

  const checkAndConsume = async (feature: string, lang: string = 'ar'): Promise<boolean> => {
    if (!user) return false;
    const isAr = lang === 'ar';

    // 1) Profile + access reads with retry+timeout. Fail-OPEN on errors.
    const profileRes = await safeRetry(
      async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('account_type, is_active, expires_at')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      null,
      { retries: 2, timeoutMs: 6000 },
    );

    const accessRes = await safeRetry(
      async () => {
        const { data, error } = await supabase
          .from('user_feature_access')
          .select('is_enabled')
          .eq('user_id', user.id)
          .eq('feature', feature)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      null,
      { retries: 2, timeoutMs: 6000 },
    );

    // Profile unavailable -> allow (don't block the user)
    if (!profileRes) return true;

    if (profileRes.is_active === false) {
      toast({
        title: isAr ? 'تم تعطيل حسابك. تواصل مع المدير.' : 'Your account is disabled.',
        variant: 'destructive',
      });
      return false;
    }

    if (profileRes.expires_at && new Date(profileRes.expires_at) < new Date()) {
      toast({
        title: isAr ? 'انتهت صلاحية حسابك. تواصل مع المدير.' : 'Your account has expired.',
        variant: 'destructive',
      });
      return false;
    }

    if (accessRes && accessRes.is_enabled === false) {
      toast({
        title: isAr ? 'هذه الميزة غير متاحة لحسابك' : 'This feature is unavailable for your account',
        variant: 'destructive',
      });
      return false;
    }

    const accountType = profileRes.account_type || 'unlimited';

    // ── Free plan rules ──
    if (accountType === 'free') {
      if (FREE_LOCKED.has(feature)) {
        toast({
          title: isAr
            ? 'هذه الميزة متاحة في الخطط المدفوعة. يرجى الترقية.'
            : 'This feature requires a paid plan. Please upgrade.',
          variant: 'destructive',
        });
        return false;
      }
      // 1-research cap on free plan
      if (feature === 'research') {
        const settings = getCachedSettings();
        const max = settings.plan_free_max_research || 1;
        const { count } = await withTimeout(
          supabase
            .from('research_projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id) as any,
          5000,
          { count: null } as any,
        );
        if (typeof count === 'number' && count >= max) {
          toast({
            title: isAr
              ? `الخطة المجانية تسمح بـ ${max} بحث فقط. يرجى الترقية.`
              : `Free plan allows only ${max} research project. Please upgrade.`,
            variant: 'destructive',
          });
          return false;
        }
      }
      // Report cap on free plan
      if (feature === 'reports' || feature === 'report') {
        const settings = getCachedSettings();
        const maxReports = 1;
        const { count } = await withTimeout(
          supabase
            .from('reports')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id) as any,
          5000,
          { count: null } as any,
        );
        if (typeof count === 'number' && count >= maxReports) {
          toast({
            title: isAr
              ? 'الخطة المجانية تسمح بتقرير واحد فقط. يرجى الترقية.'
              : 'Free plan allows only 1 report. Please upgrade.',
            variant: 'destructive',
          });
          return false;
        }
      }
      // Exam questions cap on free plan
      if (feature === 'exam_expert') {
        const settings = getCachedSettings();
        const maxExams = 1;
        const { count } = await withTimeout(
          supabase
            .from('exam_papers')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id) as any,
          5000,
          { count: null } as any,
        );
        if (typeof count === 'number' && count >= maxExams) {
          toast({
            title: isAr
              ? 'الخطة المجانية تسمح بامتحان واحد فقط. يرجى الترقية.'
              : 'Free plan allows only 1 exam. Please upgrade.',
            variant: 'destructive',
          });
          return false;
        }
      }
      return true;
    }

    // Unlimited account or zero-cost feature -> allow without points
    const cost = getCost(feature);
    if (accountType !== 'points' || cost === 0) return true;

    // Points account: consume via edge function with timeout fail-open
    const consume = await withTimeout(
      supabase.functions.invoke('admin-users', {
        body: { action: 'consume-points', userId: user.id, feature, cost },
      }),
      8000,
      { data: null, error: null } as any,
    );

    if (consume?.error) return true; // network failure -> don't block
    if (consume?.data?.allowed === false) {
      const code = consume.data.error;
      const msg = isAr
        ? (code === 'Feature disabled' ? 'هذه الميزة غير متاحة لحسابك' :
           code === 'Points expired' ? 'انتهت صلاحية النقاط' :
           code === 'Insufficient points' ? 'رصيد النقاط غير كافٍ — يرجى الترقية' :
           code === 'Account expired' ? 'انتهت صلاحية حسابك' :
           code === 'No points allocated' ? 'لا توجد نقاط مخصصة — يرجى الاشتراك' :
           'لا يمكن استخدام هذه الميزة')
        : code || 'Cannot use this feature';
      toast({ title: msg, variant: 'destructive' });
      return false;
    }
    return true;
  };

  return { checkAndConsume };
};
