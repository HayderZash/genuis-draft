import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProjectData } from '@/pages/ProjectEditor';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectData;
  onUpdate: (updates: Partial<ProjectData>) => void;
}

export const PageSettingsPanel = ({ open, onOpenChange, project, onUpdate }: Props) => {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('pageSettings')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Label className="font-semibold">{t('margins')} ({t('cm')})</Label>
          {(['margin_top', 'margin_bottom', 'margin_left', 'margin_right'] as const).map((key) => (
            <div key={key} className="flex items-center gap-3">
              <Label className="w-16 text-sm">{t(key.replace('margin_', '') as any)}</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={project[key]}
                onChange={(e) => onUpdate({ [key]: parseFloat(e.target.value) || 0 })}
                className="w-24"
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
