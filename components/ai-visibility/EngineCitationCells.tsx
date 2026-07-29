'use client';

import { cn } from '@/lib/utils';
import type {
  GoogleAioCitation,
  LlmCitation,
  PerplexityCitation,
} from '@/lib/ai-visibility/types';
import { sanitizeLlmMarkdownSync } from '@/lib/ai-visibility/sanitize';

function SkeletonPill() {
  return (
    <span className="inline-block h-6 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
  );
}

const pillBase =
  'inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[11px] font-medium';

export function GoogleAioCell({
  citation,
  dimmed,
}: {
  citation: GoogleAioCitation;
  dimmed?: boolean;
}) {
  if (citation.kind === 'loading' || citation.loading) return <SkeletonPill />;
  if (dimmed || citation.kind === 'na_rag') {
    return (
      <span
        className={cn(
          pillBase,
          'border-zinc-200 bg-zinc-50 text-zinc-400 opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500'
        )}
      >
        N/A – RAG Only
      </span>
    );
  }
  if (citation.kind === 'sync_failed') {
    return (
      <span
        className={cn(
          pillBase,
          'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
        )}
      >
        ⚠️ Sync Failed
      </span>
    );
  }
  if (citation.kind === 'omitted') {
    return (
      <span
        className={cn(
          pillBase,
          'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
        )}
      >
        Omitted
      </span>
    );
  }
  const latency = citation.latency === 'instant' ? 'Instant' : 'Delayed';
  return (
    <span
      className={cn(
        pillBase,
        'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      )}
    >
      Cited #{citation.rank} ({latency})
    </span>
  );
}

export function PerplexityCell({
  citation,
  dimmed,
}: {
  citation: PerplexityCitation;
  dimmed?: boolean;
}) {
  if (citation.kind === 'loading' || citation.loading) return <SkeletonPill />;
  if (dimmed || citation.kind === 'na_rag') {
    return (
      <span
        className={cn(
          pillBase,
          'border-zinc-200 bg-zinc-50 text-zinc-400 opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500'
        )}
      >
        N/A – RAG Only
      </span>
    );
  }
  if (citation.kind === 'sync_failed') {
    return (
      <span
        className={cn(
          pillBase,
          'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
        )}
      >
        ⚠️ Sync Failed
      </span>
    );
  }
  if (citation.kind === 'omitted') {
    return (
      <span
        className={cn(
          pillBase,
          'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
        )}
      >
        Omitted
      </span>
    );
  }
  return (
    <span
      className={cn(
        pillBase,
        'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
      )}
    >
      Cited #{citation.rank}
    </span>
  );
}

export function LlmEngineCell({ citation }: { citation: LlmCitation }) {
  if (citation.kind === 'loading' || citation.loading) return <SkeletonPill />;

  if (citation.kind === 'na_rag') {
    return (
      <span
        className={cn(
          pillBase,
          'border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500'
        )}
      >
        N/A – RAG Only
      </span>
    );
  }

  if (citation.kind === 'negative_context') {
    const safe = citation.snippet
      ? sanitizeLlmMarkdownSync(citation.snippet)
      : '';
    return (
      <span
        className={cn(
          pillBase,
          'border-rose-500/40 bg-rose-500/15 text-rose-800 dark:text-rose-300'
        )}
        title={safe.replace(/<[^>]+>/g, '')}
      >
        ⚠️ Negative Context
      </span>
    );
  }

  if (citation.kind === 'sync_failed') {
    return (
      <span
        className={cn(
          pillBase,
          'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
        )}
      >
        ⚠️ Sync Failed
      </span>
    );
  }

  if (citation.kind === 'omitted') {
    return (
      <span
        className={cn(
          pillBase,
          'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
        )}
      >
        Omitted
      </span>
    );
  }

  if (citation.kind === 'text_mention') {
    return (
      <span
        className={cn(
          pillBase,
          'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
        )}
      >
        Text Mention
      </span>
    );
  }

  return (
    <span
      className={cn(
        pillBase,
        'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      )}
    >
      Inline Link
    </span>
  );
}
