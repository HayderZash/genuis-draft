import { Progress } from '@/components/ui/progress';

interface Props {
  step: string;
  progress: number;
}

export const GenerationProgress = ({ step, progress }: Props) => {
  return (
    <div className="px-6 py-3 border-b bg-muted/30">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{step}</span>
        <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
};
