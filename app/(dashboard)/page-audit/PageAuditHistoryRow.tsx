'use client';

import Link from 'next/link';
import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight, ChevronDown, ChevronUp, Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { parseAuditData, scoreBadgeClass } from '@/lib/audit-data';
import type { RecentPageAudit } from '@/lib/page-audit/types';
import { cn } from '@/lib/utils';

type PageAuditHistoryRowProps = {
  audit: RecentPageAudit;
  isDeleting?: boolean;
  onNavigate: () => void;
  onDelete: () => void;
};

function formatAuditUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return url;
  }
}

export default function PageAuditHistoryRow({
  audit,
  isDeleting = false,
  onNavigate,
  onDelete,
}: PageAuditHistoryRowProps) {
  const [insightExpanded, setInsightExpanded] = useState(false);
  const data = parseAuditData(audit.auditData);
  const reportHref = `/page-audit/${audit.id}`;
  const displayUrl = formatAuditUrl(audit.url);
  const insight = data.analysis?.trim();
  const showInsightToggle = (insight?.length ?? 0) > 180;

  return (
    <article
      className={cn(
        'group rounded-lg border border-border bg-card p-4 shadow-sm transition-colors',
        'hover:border-border hover:bg-muted/60'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onNavigate}
          className="min-w-0 flex-1 text-left"
        >
          <p
            className="break-all text-sm font-semibold leading-snug text-foreground sm:truncate"
            title={audit.url}
          >
            {displayUrl}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {format(new Date(audit.createdAt), 'MMM d, yyyy · h:mm a')}
          </p>
        </button>

        <Badge
          variant="outline"
          className={cn('shrink-0 font-semibold tabular-nums', scoreBadgeClass(audit.geoScore))}
        >
          {audit.geoScore.toFixed(0)}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{audit.targetKeyword}</span>
        <span aria-hidden>·</span>
        <span>{data.wordCount?.toLocaleString() ?? '—'} words</span>
      </div>

      {insight ? (
        <div className="mt-3 rounded-md border border-border bg-muted/80 px-3 py-2.5">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            AI Insight
          </p>
          <p
            className={cn(
              'text-sm leading-relaxed text-foreground',
              !insightExpanded && showInsightToggle && 'line-clamp-3'
            )}
          >
            {insight}
          </p>
          {showInsightToggle ? (
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                setInsightExpanded(current => !current);
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-blue-600 dark:hover:text-blue-700"
            >
              {insightExpanded ? (
                <>
                  Show less
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Show more
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <Link
          href={reportHref}
          onClick={event => event.stopPropagation()}
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-blue-600 dark:hover:text-blue-700"
        >
          View Report
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isDeleting}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onDelete();
          }}
          className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-600"
          aria-label={`Delete audit for ${audit.url}`}
        >
          {isDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </article>
  );
}
