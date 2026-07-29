'use client';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import type { CompetitorThreat, TrackedEngine } from '@/lib/ai-visibility/types';

const ENGINE_ICON: Record<TrackedEngine, string> = {
  google_aio: 'G',
  perplexity: 'P',
  chatgpt: 'C',
  claude: 'A',
};

const sentimentClass = {
  positive:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  neutral:
    'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
  negative:
    'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export default function CompetitorThreatCell({
  threat,
}: {
  threat: CompetitorThreat;
}) {
  if (threat.kind === 'loading') {
    return (
      <span className="inline-block h-6 w-32 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
    );
  }

  if (threat.kind === 'dominating') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
        )}
      >
        🥇 Account Dominating
      </span>
    );
  }

  const visible = threat.winners.slice(0, 2);
  const extra = threat.winners.length - visible.length;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {visible.map((w) =>
          w.textMention || !w.url ? (
            <span
              key={`${w.engine}-${w.name}`}
              className="inline-flex max-w-[140px] items-center truncate rounded-md border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              title={w.name}
            >
              🤖 Text: {w.name}
            </span>
          ) : (
            <span
              key={`${w.engine}-${w.name}`}
              className="inline-flex max-w-[150px] items-center gap-1 truncate rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-950"
              title={`${w.engine}: ${w.name}`}
            >
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-zinc-800 text-[8px] font-bold text-white dark:bg-zinc-200 dark:text-zinc-900">
                {ENGINE_ICON[w.engine]}
              </span>
              <span className="truncate text-zinc-700 dark:text-zinc-300">
                {w.name}
              </span>
            </span>
          )
        )}
        {extra > 0 ? (
          <HoverCard>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="inline-flex rounded-md border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                +{extra} more
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              align="start"
              className="w-56 border-zinc-200 dark:border-zinc-800"
            >
              <ul className="space-y-1.5 text-xs">
                {threat.winners.slice(2).map((w) => (
                  <li
                    key={`more-${w.engine}-${w.name}`}
                    className="flex items-center gap-2 text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">
                      {ENGINE_ICON[w.engine]}
                    </span>
                    {w.name}
                  </li>
                ))}
              </ul>
            </HoverCardContent>
          </HoverCard>
        ) : null}
      </div>
      {threat.dominantSentiment ? (
        <span
          className={cn(
            'inline-flex w-fit rounded border px-1.5 py-0.5 text-[10px] capitalize',
            sentimentClass[threat.dominantSentiment]
          )}
        >
          Threat: {threat.dominantSentiment}
        </span>
      ) : null}
    </div>
  );
}
