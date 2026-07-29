'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown, Cloud, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  buildActionHref,
  buildArticleStudioAutoGenerateHref,
  resolvePrimaryAction,
  rowToActionPayload,
  storeVisibilityPrefill,
} from '@/lib/ai-visibility/deep-links';
import { storeVisibilityPrefill as persistVisibilityPrefill } from '@/lib/ai-visibility/prefill';
import type { TrackedEngine, VisibilityRow } from '@/lib/ai-visibility/types';
import { cn } from '@/lib/utils';

const FIX_GAP_IN_STUDIO_LABEL = 'Fix Gap in Studio';

type Props = {
  row: VisibilityRow;
  onForceSync: (promptId: string) => void;
};

export default function OptimizationActionCell({ row, onForceSync }: Props) {
  const router = useRouter();
  const action = resolvePrimaryAction(row);

  if (row.rowSyncState === 'background_syncing') {
    return (
      <div className="flex w-full items-center justify-center gap-1.5 rounded-md border border-sky-500/25 bg-sky-500/10 px-2.5 py-2 text-[11px] font-medium text-sky-800 dark:text-sky-300">
        <Cloud className="h-3.5 w-3.5 animate-pulse" />
        Background Syncing
      </div>
    );
  }

  if (action.muted) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex flex-1 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-center text-[11px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {action.label}
        </span>
        <ForceSyncButton onClick={() => onForceSync(row.promptId)} />
      </div>
    );
  }

  function navigate(
    route: typeof action.route,
    engine?: TrackedEngine | 'top'
  ) {
    const payload = rowToActionPayload(
      row,
      engine && engine !== 'top' ? engine : undefined
    );
    storeVisibilityPrefill(payload);
    router.push(buildActionHref(route, payload));
    toast.message(`Routing to ${action.label}`, {
      description: row.prompt,
    });
  }

  function navigateFixGapAutoGenerate() {
    const payload = rowToActionPayload(row);
    persistVisibilityPrefill(payload, { autoGenerate: true });
    router.push(buildArticleStudioAutoGenerateHref(payload));
    toast.message('Generating AEO draft in Article Studio', {
      description: row.prompt,
    });
  }

  const hasDropdownItems = action.dropdown.length > 0;

  return (
    <div className="flex w-full min-w-0 items-stretch gap-1">
      <div className="flex min-w-0 flex-1 items-stretch">
        <Button
          size="sm"
          className="h-8 min-w-0 flex-1 gap-1 rounded-r-none bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-500"
          onClick={() => navigate(action.route, action.engine)}
        >
          <span className="truncate">{action.label}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="h-8 rounded-l-none border-l border-emerald-500/40 bg-emerald-600 px-2 text-white hover:bg-emerald-500"
              aria-label="More optimization actions"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={4}>
            {action.dropdown.map((item) => (
              <DropdownMenuItem
                key={`${item.label}-${item.engine ?? 'x'}`}
                onClick={() => navigate(item.route, item.engine)}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
            {hasDropdownItems ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onClick={navigateFixGapAutoGenerate}>
              {FIX_GAP_IN_STUDIO_LABEL}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ForceSyncButton onClick={() => onForceSync(row.promptId)} />
    </div>
  );
}

function ForceSyncButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="icon"
      variant="outline"
      className={cn(
        'h-8 w-8 shrink-0 border-zinc-200 dark:border-zinc-800'
      )}
      onClick={onClick}
      aria-label="Force Sync"
      title="Force Sync"
    >
      <RefreshCw className="h-3.5 w-3.5" />
    </Button>
  );
}
