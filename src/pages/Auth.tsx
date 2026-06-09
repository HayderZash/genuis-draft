import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';

const Auth = () => {
  const { t, lang } = useLanguage();
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const isAr = lang === 'ar';

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password, displayName);
        if (error) throw error;
        setConfirmSent(true);
        toast({ title: t('confirmEmail') });
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (err: any) {
      toast({ title: err.message || (isAr ? 'حدث خطأ' : 'An error occurred'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setConfirmSent(false);
  };

  return (
    <div className="flex min-h-screen" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Left panel - decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-400/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 text-white">
          <div className="max-w-md text-center space-y-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm mb-4">
              <GraduationCap className="h-10 w-10" />
            </div>
            <h1 className="text-4xl font-bold leading-tight">
              {isAr ? 'منصة المساعد الأكاديمي' : 'Academic Assistant Platform'}
            </h1>
            <p className="text-lg text-blue-100 leading-relaxed">
              {isAr
                ? 'مساعدك الذكي لإنجاز البحوث والتقارير والرسائل الأكاديمية بجودة عالية وسرعة فائقة'
                : 'Your smart assistant for high-quality academic research, reports, and theses at incredible speed'}
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              {[
                isAr ? 'بحوث أكاديمية' : 'Academic Research',
                isAr ? 'تدقيق لغوي' : 'Proofreading',
                isAr ? 'ترجمة' : 'Translation',
                isAr ? 'تقارير' : 'Reports',
              ].map((tag, i) => (
                <span
                  key={i}
                  className="px-4 py-1.5 rounded-full text-sm bg-white/15 backdrop-blur-sm border border-white/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-primary">
              {isAr ? 'منصة المساعد الأكاديمي' : 'Academic Assistant Platform'}
            </h1>
          </div>

          {/* Form header */}
          <div className="text-center lg:text-start space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">
              {mode === 'login' ? t('login') : t('signup')}
            </h2>
            <p className="text-muted-foreground">
              {mode === 'login'
                ? (isAr ? 'أدخل بياناتك للوصول إلى حسابك' : 'Enter your credentials to access your account')
                : (isAr ? 'أنشئ حسابك الجديد للبدء' : 'Create your new account to get started')}
            </p>
          </div>

          {/* Confirmation message */}
          {confirmSent && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <p className="font-medium text-emerald-700 dark:text-emerald-400">{t('confirmEmail')}</p>
              </div>
              <p className="text-sm text-emerald-600 dark:text-emerald-500">
                {isAr ? 'تحقق من بريدك الإلكتروني وانقر على رابط التأكيد' : 'Check your email and click the confirmation link'}
              </p>
            </div>
          )}

          {/* Form */}
          {!confirmSent && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">{t('displayName')}</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={isAr ? 'أدخل اسمك الكامل' : 'Enter your full name'}
                    required
                    className="h-11"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isAr ? 'example@email.com' : 'example@email.com'}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-11 pe-11"
                    placeholder={isAr ? '••••••••' : '••••••••'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute end-0 top-0 h-11 w-11"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full h-11 gap-2" disabled={submitting}>
                {submitting ? (
                  <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowRight className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} />
                )}
                {mode === 'login' ? t('login') : t('signup')}
              </Button>
            </form>
          )}

          {/* Switch mode */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {mode === 'login' ? t('noAccount') : t('haveAccount')}
              {' '}
              <button
                onClick={switchMode}
                className="text-primary font-medium hover:underline underline-offset-4"
              >
                {mode === 'login' ? t('signup') : t('login')}
              </button>
            </p>
          </div>

          {/* Back to landing */}
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => navigate('/landing')}>
              {isAr ? 'العودة للصفحة الرئيسية' : 'Back to homepage'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
