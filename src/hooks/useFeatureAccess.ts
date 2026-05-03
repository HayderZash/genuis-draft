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
  exam_expert: 0.01, // per-question; for 10 questions UI shows 0.1
};

export const useFeatureAccess = () => {
  const { user } = useAuth();

  const checkAndConsume = async (feature: string, lang: string = 'ar'): Promise<boolean> => {
    if (!user) return false;
    const cost = FEATURE_COSTS[feature] ?? 0;

    try {
      const [profileRes, accessRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('account_type, is_active, expires_at')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_feature_access')
          .select('is_enabled')
          .eq('user_id', user.id)
          .eq('feature', feature)
          .maybeSingle(),
      ]);

      const profile = profileRes.data;
      const access = accessRes.data;

      if (!profile) {
        toast({
          title: lang === 'ar' ? 'تعذر التحقق من الحساب حالياً' : 'Could not verify account right now',
          variant: 'destructive',
        });
        return false;
      }

      if (!profile.is_active) {
        toast({ title: lang === 'ar' ? 'تم تعطيل حسابك. تواصل مع المدير.' : 'Your account is disabled.', variant: 'destructive' });
        return false;
      }

      if (profile.expires_at && new Date(profile.expires_at) < new Date()) {
        toast({ title: lang === 'ar' ? 'انتهت صلاحية حسابك. تواصل مع المدير.' : 'Your account has expired.', variant: 'destructive' });
        return false;
      }

      if (access && !access.is_enabled) {
        toast({ title: lang === 'ar' ? 'هذه الميزة غير متاحة لحسابك' : 'This feature is unavailable for your account', variant: 'destructive' });
        return false;
      }

      if (profile.account_type !== 'points' || cost === 0) {
        return true;
      }

      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'consume-points', userId: user.id, feature, cost },
      });

      if (error) throw error;
      if (data?.allowed === false) {
        const msg = lang === 'ar'
          ? (data.error === 'Feature disabled' ? 'هذه الميزة غير متاحة لحسابك' :
             data.error === 'Points expired' ? 'انتهت صلاحية النقاط' :
             data.error === 'Insufficient points' ? 'رصيد النقاط غير كافٍ' :
             'لا يمكن استخدام هذه الميزة')
          : data.error || 'Cannot use this feature';
        toast({ title: msg, variant: 'destructive' });
        return false;
      }
      return true;
    } catch {
      toast({
        title: lang === 'ar' ? 'تعذر التحقق من صلاحية الميزة حالياً، حاول مرة أخرى' : 'Could not verify feature access right now, please try again',
        variant: 'destructive',
      });
      return false;
    }
  };

  return { checkAndConsume };
};
