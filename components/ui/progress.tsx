'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

const Progress = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'> & { value?: number | null }
>(({ className, value, ...props }, ref) => {
  const clamped = Math.min(100, Math.max(0, value ?? 0));

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      className={cn(
        'relative h-4 w-full overflow-hidden rounded-full bg-secondary',
        className
      )}
      {...props}
    >
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
});
Progress.displayName = 'Progress';

export { Progress };
