'use client';

import { useMemo } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type LiveManifestPreviewProps = {
  manifest: Record<string, unknown>;
  className?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  hasPendingDraft?: boolean;
  publishedVersion?: number;
  draftVersion?: number;
};

export default function LiveManifestPreview({
  manifest,
  className,
  onRefresh,
  isRefreshing = false,
  hasPendingDraft = false,
  publishedVersion,
  draftVersion,
}: LiveManifestPreviewProps) {
  const formatted = useMemo(() => JSON.stringify(manifest, null, 2), [manifest]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatted);
      toast.success('Manifest JSON copied to clipboard.');
    } catch {
      toast.error('Unable to copy manifest.');
    }
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Domain Manifest Preview
            </p>
            {hasPendingDraft ? (
              <Badge
                variant="outline"
                className="h-5 border-amber-200 text-[10px] text-amber-800 dark:border-amber-900 dark:text-amber-300"
              >
                Draft pending publish
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="h-5 border-emerald-200 text-[10px] text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"
              >
                Published
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Draft v{draftVersion ?? 0}
            {typeof publishedVersion === 'number' ? ` · Published v${publishedVersion}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {onRefresh ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('mr-1 h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
              Sync
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => void handleCopy()}
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            Copy
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground">
          <code>{formatted}</code>
        </pre>
      </ScrollArea>
    </div>
  );
}
