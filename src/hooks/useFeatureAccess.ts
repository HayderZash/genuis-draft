import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const FEATURE_COSTS: Record<string, number> = {
  research: 2,
  reports: 1,
  cv: 0.5,
  proofreading: 0.5,
  translator: 0,
  summarizer: 0.25,
  plagiarism: 0.5,
  'image-gen': 0.1,
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
      return true; // Allow on error (fail-open for better UX)
    }
  };

  return { checkAndConsume };
};
