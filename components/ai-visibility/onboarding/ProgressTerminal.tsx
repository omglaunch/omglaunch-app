'use client';

import { cn } from '@/lib/utils';
import type { SseTerminalLine } from '@/lib/ai-visibility/onboarding/types';

export default function ProgressTerminal({
  lines,
  className,
}: {
  lines: SseTerminalLine[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'max-h-40 overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 dark:border-zinc-800',
        className
      )}
    >
      {lines.length === 0 ? (
        <span className="text-zinc-500">Awaiting job…</span>
      ) : (
        lines.map((line) => (
          <div
            key={line.id}
            className={cn(
              line.level === 'error' && 'text-rose-400',
              line.level === 'success' && 'text-emerald-400',
              line.level === 'warn' && 'text-amber-400',
              line.level === 'ping' && 'text-zinc-600'
            )}
          >
            <span className="text-zinc-600">
              [{new Date(line.ts).toLocaleTimeString()}]
            </span>{' '}
            {line.message}
          </div>
        ))
      )}
    </div>
  );
}
