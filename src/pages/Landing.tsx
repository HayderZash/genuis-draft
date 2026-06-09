import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, CircleCheck as CheckCircle, FileSpreadsheet, CircleUser as UserCircle, BookOpen, Languages, ShieldCheck, ClipboardList, MessageCircle, Send, Mail, GraduationCap, Sparkles, ArrowRight } from 'lucide-react';

const Landing = () => {
  const { lang, setLang } = useLanguage();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [contactInfo, setContactInfo] = useState({ whatsapp: '', telegram: '', email: '' });
  const isAr = lang === 'ar';

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [user, loading]);

  useEffect(() => {
    // Cache contact info in localStorage to avoid blocking on slow/unavailable backend
    const cached = localStorage.getItem('contact_info_cache');
    if (cached) {
      try { setContactInfo(JSON.parse(cached)); } catch {}
    }

    const fetchContact = async () => {
      try {
        // Hard timeout: never let this request block the UI for more than 5s
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const { data, error } = await supabase
          .from('platform_settings')
          .select('key, value')
          .abortSignal(controller.signal);
        clearTimeout(timer);
        if (error || !data) return;
        const map: any = { whatsapp: '', telegram: '', email: '' };
        data.forEach((s: any) => {
          if (s.key === 'contact_whatsapp') map.whatsapp = s.value;
          if (s.key === 'contact_telegram') map.telegram = s.value;
          if (s.key === 'contact_email') map.email = s.value;
        });
        setContactInfo(map);
        localStorage.setItem('contact_info_cache', JSON.stringify(map));
      } catch {
        // Silent fail – cached or empty values are fine
      }
    };
    fetchContact();
  }, []);

  const features = [
    { icon: FileText, title: isAr ? 'البحوث الأكاديمية' : 'Academic Research', desc: isAr ? 'توليد بحوث تخرج كاملة بالذكاء الاصطناعي مع المراجع والتنسيق الأكاديمي' : 'AI-powered full graduation research with references and academic formatting', color: 'text-blue-600' },
    { icon: GraduationCap, title: isAr ? 'رسائل الدراسات العليا' : 'Graduate Theses', desc: isAr ? 'كتابة رسائل الماجستير والدكتوراه بمنهجية بحثية ومصادر معتمدة' : 'Master & PhD theses with research methodology and verified sources', color: 'text-indigo-600' },
    { icon: ShieldCheck, title: isAr ? 'التدقيق والكشف الأكاديمي' : 'Academic Proofreading & Plagiarism', desc: isAr ? 'تدقيق لغوي شامل + كشف نسبة الاستلال في أداة موحدة' : 'Linguistic proofreading + plagiarism detection in one tool', color: 'text-emerald-600' },
    { icon: FileSpreadsheet, title: isAr ? 'التقارير العلمية' : 'Scientific Reports', desc: isAr ? 'إنشاء تقارير علمية ومختبرية احترافية جاهزة للتسليم' : 'Create professional scientific and lab reports ready for submission', color: 'text-amber-600' },
    { icon: ClipboardList, title: isAr ? 'خبير الامتحانات' : 'Exam Expert', desc: isAr ? 'توليد أسئلة امتحانية أكاديمية متنوعة من أي محتوى أو محاضرة' : 'Generate diverse academic exam questions from any content or lecture', color: 'text-orange-600' },
    { icon: UserCircle, title: isAr ? 'السيرة الذاتية' : 'CV Builder', desc: isAr ? 'إنشاء سيرة ذاتية احترافية متوافقة مع أنظمة ATS الحديثة' : 'Build professional ATS-compatible CVs', color: 'text-violet-600' },
    { icon: BookOpen, title: isAr ? 'تلخيص النصوص' : 'Text Summarizer', desc: isAr ? 'تلخيص النصوص الطويلة والأبحاث بشكل ذكي ومختصر' : 'Smart summarization of long texts and research papers', color: 'text-cyan-600' },
    { icon: Languages, title: isAr ? 'الترجمة الأكاديمية' : 'Academic Translation', desc: isAr ? 'ترجمة أكاديمية دقيقة بين العربية والإنجليزية' : 'Precise academic translation between Arabic and English', color: 'text-rose-600' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-bold text-primary">{isAr ? 'منصة المساعد الأكاديمي' : 'Academic Assistant Platform'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLang(isAr ? 'en' : 'ar')}>
              {isAr ? 'EN' : 'عربي'}
            </Button>
            <Button onClick={() => navigate('/auth')} variant="outline" size="sm" className="gap-1">
              {isAr ? 'إنشاء حساب' : 'Sign Up'} <ArrowRight className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate('/auth')} size="sm" className="gap-1">
              {isAr ? 'تسجيل الدخول' : 'Login'} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm text-muted-foreground mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            {isAr ? 'مدعوم بالذكاء الاصطناعي' : 'Powered by AI'}
          </div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
            {isAr ? 'مساعدك الأكاديمي الذكي لإنجاز مشاريعك بجودة عالية' : 'Your Smart Academic Assistant for High-Quality Projects'}
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            {isAr ? 'منصة متكاملة تجمع أدوات البحث الأكاديمي والتدقيق والترجمة وإنشاء التقارير والسير الذاتية في مكان واحد' : 'An integrated platform combining academic research, proofreading, translation, reports, and CV tools in one place'}
          </p>
          <Button size="lg" onClick={() => navigate('/auth')} className="text-lg px-8 py-6">
            {isAr ? 'ابدأ الآن' : 'Get Started'}
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">
            {isAr ? 'ميزات المنصة' : 'Platform Features'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <Card key={i} className="border-2 hover:border-primary/30 transition-all hover:shadow-lg">
                <CardContent className="pt-8 pb-6 text-center">
                  <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
                    <f.icon className={`h-8 w-8 ${f.color}`} />
                  </div>
                  <h4 className="font-bold text-lg mb-2">{f.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <h3 className="text-3xl font-bold mb-4">
            {isAr ? 'للحصول على حساب' : 'Get an Account'}
          </h3>
          <p className="text-muted-foreground mb-8">
            {isAr ? 'للحصول على حساب في منصة المساعد الأكاديمي تواصل مع مسؤول المنصة على الحسابات التالية' : 'To get an account on the Academic Assistant Platform, contact the platform administrator through the following channels'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {contactInfo.whatsapp && (
              <a href={`https://wa.me/${contactInfo.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 hover:border-primary/50 transition-colors bg-background">
                <MessageCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium" dir="ltr">{contactInfo.whatsapp}</span>
              </a>
            )}
            {contactInfo.telegram && (
              <a href={contactInfo.telegram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 hover:border-primary/50 transition-colors bg-background">
                <Send className="h-5 w-5 text-blue-500" />
                <span className="font-medium">{isAr ? 'تليكرام' : 'Telegram'}</span>
              </a>
            )}
            {contactInfo.email && (
              <a href={`mailto:${contactInfo.email}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 hover:border-primary/50 transition-colors bg-background">
                <Mail className="h-5 w-5 text-pink-500" />
                <span className="font-medium" dir="ltr">{contactInfo.email}</span>
              </a>
            )}
          </div>
          {!contactInfo.whatsapp && !contactInfo.telegram && !contactInfo.email && (
            <p className="text-sm text-muted-foreground mt-4">
              {isAr ? 'لم يتم إضافة معلومات التواصل بعد' : 'Contact information not yet configured'}
            </p>
          )}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>{isAr ? '© 2026 منصة المساعد الأكاديمي. جميع الحقوق محفوظة.' : '© 2026 Academic Assistant Platform. All rights reserved.'}</p>
      </footer>
    </div>
  );
};

export default Landing;
