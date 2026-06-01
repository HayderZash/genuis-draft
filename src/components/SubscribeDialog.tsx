import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, Send, Mail, Copy, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { toast } from '@/hooks/use-toast';

interface SubscribeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planLabel?: string;
}

export const SubscribeDialog = ({ open, onOpenChange, planLabel }: SubscribeDialogProps) => {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const { settings } = usePlatformSettings();

  const copy = (val: string, label: string) => {
    navigator.clipboard.writeText(val).then(() => {
      toast({ title: isAr ? `تم نسخ ${label}` : `${label} copied` });
    });
  };

  const waNumber = settings.contact_whatsapp.replace(/\D/g, '').replace(/^0/, '964');
  const msg = encodeURIComponent(
    isAr
      ? `مرحبًا، أرغب بتفعيل اشتراك ${planLabel || ''} على منصة Genius Draft.`
      : `Hello, I would like to activate the ${planLabel || ''} plan on Genius Draft.`
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={isAr ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            {isAr ? 'تفعيل الاشتراك' : 'Activate Subscription'}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? `للاشتراك في ${planLabel ? `خطة ${planLabel}` : 'إحدى الخطط'}، تواصل معنا عبر إحدى الوسائل التالية وسيتم تفعيل حسابك خلال دقائق.`
              : `To subscribe to ${planLabel || 'one of our plans'}, contact us via any of these channels and your account will be activated within minutes.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* WhatsApp */}
          <div className="rounded-lg border p-3 flex items-center justify-between gap-2 bg-emerald-500/5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-md bg-emerald-500/10">
                <Phone className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{isAr ? 'واتساب' : 'WhatsApp'}</p>
                <p className="text-sm font-mono truncate" dir="ltr">{settings.contact_whatsapp}</p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copy(settings.contact_whatsapp, 'WhatsApp')}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" asChild>
                <a href={`https://wa.me/${waNumber}?text=${msg}`} target="_blank" rel="noopener noreferrer">
                  {isAr ? 'فتح' : 'Open'}
                </a>
              </Button>
            </div>
          </div>

          {/* Telegram */}
          <div className="rounded-lg border p-3 flex items-center justify-between gap-2 bg-sky-500/5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-md bg-sky-500/10">
                <Send className="h-4 w-4 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{isAr ? 'تيليغرام' : 'Telegram'}</p>
                <p className="text-sm font-mono truncate" dir="ltr">@{settings.contact_telegram.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '')}</p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copy(settings.contact_telegram, 'Telegram')}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" asChild>
                <a href={`https://t.me/${settings.contact_telegram.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '')}`} target="_blank" rel="noopener noreferrer">
                  {isAr ? 'فتح' : 'Open'}
                </a>
              </Button>
            </div>
          </div>

          {/* Email */}
          <div className="rounded-lg border p-3 flex items-center justify-between gap-2 bg-primary/5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-md bg-primary/10">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{isAr ? 'البريد الإلكتروني' : 'Email'}</p>
                <p className="text-sm font-mono truncate" dir="ltr">{settings.contact_email}</p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copy(settings.contact_email, 'Email')}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" asChild>
                <a href={`mailto:${settings.contact_email}?subject=${encodeURIComponent('Subscription Activation')}&body=${msg}`}>
                  {isAr ? 'إرسال' : 'Send'}
                </a>
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          {isAr
            ? 'الاشتراكات شهرية. الدفع يدوي عبر التواصل.'
            : 'Monthly subscriptions. Manual payment via direct contact.'}
        </p>
      </DialogContent>
    </Dialog>
  );
};
