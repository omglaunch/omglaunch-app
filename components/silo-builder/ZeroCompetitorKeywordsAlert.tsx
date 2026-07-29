import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ZeroCompetitorKeywordsAlertProps = {
  message: string;
  className?: string;
};

export default function ZeroCompetitorKeywordsAlert({
  message,
  className,
}: ZeroCompetitorKeywordsAlertProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100',
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-medium">Zero Results</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">{message}</p>
        </div>
      </div>
    </div>
  );
}
