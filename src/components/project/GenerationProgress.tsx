import { Progress } from '@/components/ui/progress';
import { ImageIcon, FileText } from 'lucide-react';

interface Props {
  step: string;
  progress: number;
  phase?: 'text' | 'images';
}

export const GenerationProgress = ({ step, progress, phase = 'text' }: Props) => {
  const isImagePhase = phase === 'images';

  return (
    <div className="px-6 py-3 border-b bg-muted/30">
      <div className="flex items-center gap-2 mb-1">
        {isImagePhase ? (
          <ImageIcon className="h-4 w-4 text-purple-500 animate-pulse" />
        ) : (
          <FileText className="h-4 w-4 text-primary animate-pulse" />
        )}
        <span className="text-sm font-medium flex-1">{step}</span>
        <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
};
