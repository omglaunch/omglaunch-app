'use client';

import { scoreColorClass } from '@/lib/audit-data';
import { cn } from '@/lib/utils';

type ScoreRingProps = {
  score: number;
  label: string;
  size?: 'sm' | 'md';
  /** Use onDark when the ring sits on a colored banner (e.g. executive summary header). */
  variant?: 'default' | 'onDark';
};

export default function ScoreRing({
  score,
  label,
  size = 'md',
  variant = 'default',
}: ScoreRingProps) {
  const colors = scoreColorClass(score);
  const radius = size === 'sm' ? 40 : 48;
  const svgSize = size === 'sm' ? 'h-28 w-28' : 'h-36 w-36';
  const containerSize = size === 'sm' ? 'h-32 w-32' : 'h-40 w-40';
  const scoreTextSize = size === 'sm' ? 'text-3xl' : 'text-4xl';
  const circumference = 2 * Math.PI * radius;
  const progress = (Math.min(Math.max(score, 0), 100) / 100) * circumference;
  const scoreTextClass =
    variant === 'onDark'
      ? cn(
          'text-zinc-900',
          score >= 80 && 'dark:text-emerald-600',
          score >= 60 && score < 80 && 'dark:text-amber-600',
          score < 60 && 'dark:text-red-600'
        )
      : colors.text;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full',
          containerSize,
          colors.bg
        )}
      >
        <svg className={cn('absolute -rotate-90', svgSize)} viewBox="0 0 120 120" aria-hidden>
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
            className="stroke-white/80"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={colors.ring}
            strokeDasharray={`${progress} ${circumference}`}
          />
        </svg>
        <div className="relative text-center">
          <p className={cn('font-bold tabular-nums tracking-tight', scoreTextSize, scoreTextClass)}>
            {score.toFixed(0)}
          </p>
        </div>
      </div>
      <p
        className={cn(
          'max-w-[120px] text-center text-xs font-medium',
          variant === 'onDark' ? 'text-zinc-600 dark:text-zinc-300' : 'text-gray-600'
        )}
      >
        {label}
      </p>
    </div>
  );
}
