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
        title: lang === 'ar' ? 'تعذر التحقق من صلاحية الميزة حالياً' : 'Could not verify feature access right now',
        variant: 'destructive',
      });
      return false;
    }
  };

  return { checkAndConsume };
};
