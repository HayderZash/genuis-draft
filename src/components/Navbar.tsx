import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Globe, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { SettingsDialog } from './SettingsDialog';

export const Navbar = () => {
  const { lang, setLang, t } = useLanguage();
  const { user, signOut } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <h1 className="text-lg font-bold text-primary">{t('appName')}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="gap-1"
            >
              <Globe className="h-4 w-4" />
              {lang === 'ar' ? 'EN' : 'عربي'}
            </Button>
            {user && (
              <>
                <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={signOut}>
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
