import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins } from 'lucide-react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

interface FeaturePointInfo {
  feature: string;
  points_remaining: number;
  expires_at: string | null;
}

const FEATURE_LABELS: Record<string, { ar: string; en: string }> = {
  research: { ar: 'البحوث الأكاديمية', en: 'Research' },
  thesis: { ar: 'رسائل الدراسات العليا', en: 'Theses' },
  reports: { ar: 'التقارير', en: 'Reports' },
  cv: { ar: 'السيرة الذاتية', en: 'CV' },
  proofreading: { ar: 'التدقيق والكشف الأكاديمي', en: 'Proofreading & Plagiarism' },
  summarizer: { ar: 'التلخيص', en: 'Summarizer' },
  exam_expert: { ar: 'خبير الامتحانات', en: 'Exam Expert' },
  translator: { ar: 'الترجمة', en: 'Translation' },
};

// Maps UI feature key -> platform_settings cost key
const COST_KEY: Record<string, string> = {
  research: 'cost_research',
  thesis: 'cost_thesis',
  reports: 'cost_report',
  cv: 'cost_cv',
  proofreading: 'cost_proofread',
  summarizer: 'cost_summarize',
  exam_expert: 'cost_exam',
  translator: 'cost_translate',
};

export const PointsPanel = () => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const { settings } = usePlatformSettings();
  const [accountType, setAccountType] = useState<string>('unlimited');
  const [points, setPoints] = useState<FeaturePointInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('user_id', user.id)
        .single();
      
      setAccountType(profile?.account_type || 'unlimited');

      if (profile?.account_type === 'points') {
        const { data: pts } = await supabase
          .from('user_feature_points')
          .select('feature, points_remaining, expires_at')
          .eq('user_id', user.id);
        setPoints(pts || []);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) return null;
  if (accountType === 'unlimited') {
    return (
      <Card className="mb-6">
        <CardContent className="py-4 flex items-center gap-3">
          <Coins className="h-5 w-5 text-primary" />
          <span className="font-medium">
            {lang === 'ar' ? 'حسابك غير محدود - استخدام مفتوح لجميع الميزات' : 'Unlimited account - open access to all features'}
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          {lang === 'ar' ? 'رصيد النقاط' : 'Points Balance'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(FEATURE_LABELS).map(([key, label]) => {
            const pt = points.find(p => p.feature === key);
            const cost = FEATURE_COSTS[key];
            const isExpired = pt?.expires_at ? new Date(pt.expires_at) < new Date() : false;
            
            return (
              <div key={key} className="flex flex-col p-3 border rounded-lg bg-muted/30">
                <span className="text-sm font-medium">{label[lang]}</span>
                <div className="flex items-center gap-2 mt-1">
                  {cost === 0 ? (
                    <Badge variant="secondary" className="text-xs">{lang === 'ar' ? 'مجاني' : 'Free'}</Badge>
                  ) : (
                    <>
                      <span className={`text-lg font-bold ${isExpired ? 'text-destructive' : pt && pt.points_remaining > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {pt ? pt.points_remaining : 0}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({lang === 'ar' ? `تكلفة: ${cost}` : `cost: ${cost}`})
                      </span>
                    </>
                  )}
                </div>
                {pt?.expires_at && (
                  <span className={`text-xs mt-1 ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {isExpired 
                      ? (lang === 'ar' ? 'منتهية الصلاحية' : 'Expired')
                      : `${lang === 'ar' ? 'تنتهي:' : 'Expires:'} ${new Date(pt.expires_at).toLocaleDateString()}`
                    }
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
