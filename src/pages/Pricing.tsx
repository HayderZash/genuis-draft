import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, X, Sparkles, Crown, Zap, Star, Gift } from 'lucide-react';
import { SubscribeDialog } from '@/components/SubscribeDialog';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

interface PlanFeature {
  ar: string;
  en: string;
  included: boolean;
}

const Pricing = () => {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const navigate = useNavigate();
  const { settings } = usePlatformSettings();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');

  const openSubscribe = (label: string) => {
    setSelectedPlan(label);
    setDialogOpen(true);
  };

  const fmtIQD = (n: number) => `${n.toLocaleString(isAr ? 'ar-IQ' : 'en-US')} ${isAr ? 'د.ع' : 'IQD'}`;

  const plans = [
    {
      id: 'free',
      name: isAr ? 'مجاني' : 'Free',
      price: 0,
      period: '',
      icon: Gift,
      color: 'border-border',
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      badge: null,
      points: null,
      features: [
        { ar: `${settings.plan_free_max_research} بحث أكاديمي (${settings.plan_free_max_pages_per_chapter} صفحات/فصل)`, en: `${settings.plan_free_max_research} research project (${settings.plan_free_max_pages_per_chapter} pages/chapter)`, included: true },
        { ar: 'بدون توليد صور (عناوين فقط)', en: 'No image generation (titles only)', included: true },
        { ar: `تقرير علمي واحد (حد أقصى ${settings.plan_free_report_pages} صفحات)`, en: `1 scientific report (max ${settings.plan_free_report_pages} pages)`, included: true },
        { ar: `خبير الامتحانات: ${settings.plan_free_exam_questions} أسئلة فقط`, en: `Exam Expert: ${settings.plan_free_exam_questions} questions only`, included: true },
        { ar: `تلخيص النصوص (حتى ${settings.plan_free_summary_chars} حرف)`, en: `Text summarizer (up to ${settings.plan_free_summary_chars} chars)`, included: true },
        { ar: 'الترجمة الأكاديمية الكاملة', en: 'Full academic translation', included: true },
        { ar: 'رسائل الدراسات العليا', en: 'Graduate theses', included: false },
        { ar: 'التدقيق والكشف الأكاديمي', en: 'Academic proofreading', included: false },
        { ar: 'السيرة الذاتية', en: 'CV Builder', included: false },
      ] as PlanFeature[],
    },
    {
      id: '5k',
      name: isAr ? 'مبتدئ' : 'Starter',
      price: settings.plan_5k_price,
      period: isAr ? '/شهر' : '/month',
      icon: Zap,
      color: 'border-blue-500/40',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      badge: null,
      points: settings.plan_5k_points,
      features: [
        { ar: `${settings.plan_5k_points} نقطة شهرياً`, en: `${settings.plan_5k_points} points/month`, included: true },
        { ar: 'وصول كامل لجميع الميزات', en: 'Full access to all features', included: true },
        { ar: 'بحوث كاملة دون شروط', en: 'Full unrestricted research', included: true },
        { ar: 'رسائل الدراسات العليا', en: 'Graduate theses', included: true },
        { ar: 'تدقيق + تلخيص + ترجمة مفتوحة', en: 'Unlimited proofreading + summary + translation', included: true },
      ] as PlanFeature[],
    },
    {
      id: '10k',
      name: isAr ? 'احترافي' : 'Pro',
      price: settings.plan_10k_price,
      period: isAr ? '/شهر' : '/month',
      icon: Star,
      color: 'border-primary',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      badge: isAr ? 'الأكثر شعبية' : 'Most Popular',
      points: settings.plan_10k_points,
      features: [
        { ar: `${settings.plan_10k_points} نقطة شهرياً`, en: `${settings.plan_10k_points} points/month`, included: true },
        { ar: 'وصول كامل لجميع الميزات', en: 'Full access to all features', included: true },
        { ar: 'بحوث كاملة دون شروط', en: 'Full unrestricted research', included: true },
        { ar: 'رسائل الدراسات العليا', en: 'Graduate theses', included: true },
        { ar: 'دعم بالأولوية', en: 'Priority support', included: true },
      ] as PlanFeature[],
    },
    {
      id: '25k',
      name: isAr ? 'متقدم' : 'Advanced',
      price: settings.plan_25k_price,
      period: isAr ? '/شهر' : '/month',
      icon: Sparkles,
      color: 'border-purple-500/40',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
      badge: null,
      points: settings.plan_25k_points,
      features: [
        { ar: `${settings.plan_25k_points} نقطة شهرياً`, en: `${settings.plan_25k_points} points/month`, included: true },
        { ar: 'وصول كامل + أولوية المعالجة', en: 'Full access + priority queue', included: true },
        { ar: 'حصة كبيرة من البحوث والرسائل', en: 'Large quota of research & theses', included: true },
        { ar: 'دعم مخصص', en: 'Dedicated support', included: true },
      ] as PlanFeature[],
    },
    {
      id: 'unlimited',
      name: isAr ? 'غير محدود' : 'Unlimited',
      price: settings.plan_unlimited_price,
      period: isAr ? '/شهر' : '/month',
      icon: Crown,
      color: 'border-amber-500/40',
      iconBg: 'bg-gradient-to-br from-amber-500/20 to-yellow-500/20',
      iconColor: 'text-amber-500',
      badge: isAr ? 'بدون حدود' : 'No Limits',
      points: null,
      features: [
        { ar: 'كل شيء مفتوح بشكل تام', en: 'Everything fully unlocked', included: true },
        { ar: 'بدون عداد نقاط', en: 'No point counter', included: true },
        { ar: 'أولوية قصوى', en: 'Highest priority', included: true },
        { ar: 'دعم VIP', en: 'VIP support', included: true },
      ] as PlanFeature[],
    },
  ];

  const consumption = [
    { ar: 'بحث كامل', en: 'Full research', cost: settings.cost_research },
    { ar: 'رسالة دراسات عليا', en: 'Graduate thesis', cost: settings.cost_thesis },
    { ar: 'تقرير علمي', en: 'Scientific report', cost: settings.cost_report },
    { ar: 'خبير الامتحانات (50 سؤال)', en: 'Exam Expert (50 questions)', cost: settings.cost_exam },
    { ar: 'السيرة الذاتية', en: 'CV', cost: settings.cost_cv },
    { ar: 'التدقيق والكشف', en: 'Proofreading', cost: settings.cost_proofread, free: true },
    { ar: 'تلخيص النصوص', en: 'Summarizer', cost: settings.cost_summarize, free: true },
    { ar: 'الترجمة الأكاديمية', en: 'Translation', cost: settings.cost_translate, free: true },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-1 mb-6">
          <ArrowLeft className="h-4 w-4" /> {isAr ? 'العودة' : 'Back'}
        </Button>

        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3 gap-1.5">
            <Sparkles className="h-3 w-3" /> {isAr ? 'باقات الاشتراك' : 'Subscription Plans'}
          </Badge>
          <h1 className="text-4xl font-bold mb-3">
            {isAr ? 'اختر الخطة المناسبة لك' : 'Choose the right plan for you'}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {isAr
              ? 'اشتراكات شهرية مرنة بأسعار مناسبة. الدفع يدوي عبر التواصل المباشر.'
              : 'Flexible monthly subscriptions at fair prices. Manual payment via direct contact.'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card key={plan.id} className={`relative border-2 ${plan.color} flex flex-col`}>
                {plan.badge && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    {plan.badge}
                  </Badge>
                )}
                <CardHeader className="text-center pb-3">
                  <div className={`mx-auto p-3 rounded-xl ${plan.iconBg} w-fit mb-2`}>
                    <Icon className={`h-6 w-6 ${plan.iconColor}`} />
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-foreground">
                        {plan.price === 0 ? (isAr ? 'مجاناً' : 'Free') : fmtIQD(plan.price)}
                      </span>
                      {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                    </div>
                    {plan.points !== null && (
                      <p className="text-xs mt-1 text-primary font-medium">
                        {isAr ? `${plan.points} نقطة شهرياً` : `${plan.points} points/month`}
                      </p>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-2 mb-5 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        {f.included ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <span className={f.included ? '' : 'text-muted-foreground line-through'}>
                          {isAr ? f.ar : f.en}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {plan.id === 'free' ? (
                    <Button variant="outline" className="w-full" disabled>
                      {isAr ? 'الخطة الحالية' : 'Current plan'}
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={() => openSubscribe(plan.name)}>
                      {isAr ? 'اشترك الآن' : 'Subscribe'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Consumption rates */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">{isAr ? 'أسعار استهلاك النقاط' : 'Point Consumption Rates'}</CardTitle>
            <CardDescription>
              {isAr ? 'تُخصم النقاط من رصيدك الشهري لكل عملية وفق الجدول التالي:' : 'Points are deducted from your monthly balance per operation:'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2">
              {consumption.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <span className="text-sm">{isAr ? c.ar : c.en}</span>
                  {c.free ? (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-600/30">
                      {isAr ? 'مفتوح' : 'Free'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      {c.cost} {isAr ? 'نقطة' : 'pts'}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <SubscribeDialog open={dialogOpen} onOpenChange={setDialogOpen} planLabel={selectedPlan} />
    </div>
  );
};

export default Pricing;
