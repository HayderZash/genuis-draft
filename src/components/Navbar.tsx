import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Globe, LogOut, Settings, Shield, Crown } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsDialog } from './SettingsDialog';

export const Navbar = () => {
  const { lang, setLang, t } = useLanguage();
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-6xl mx-auto flex h-14 items-center justify-between px-4 md:px-6">
          <h1
            className="text-lg font-bold text-primary cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/')}
          >
            {t('appName')}
          </h1>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'EN' : 'عربي'}</span>
            </Button>
            {user && (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/pricing')} className="gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                  <Crown className="h-4 w-4" />
                  <span className="hidden sm:inline">{lang === 'ar' ? 'الاشتراكات' : 'Pricing'}</span>
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="gap-1.5 text-primary hover:bg-primary/10">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">{lang === 'ar' ? 'الإدارة' : 'Admin'}</span>
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} className="text-muted-foreground hover:text-foreground">
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-destructive">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};
