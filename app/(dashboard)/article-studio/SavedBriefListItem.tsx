'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Check, Loader2, Trash2 } from 'lucide-react';
import type { ContentBriefRecord } from '@/lib/content-pipeline-data';
import { cn } from '@/lib/utils';

type SavedBriefListItemProps = {
  brief: ContentBriefRecord;
  isActive: boolean;
  isDeleting?: boolean;
  onSelect: () => void;
  onDelete: (briefId: number) => void;
};

function getLatestArticle(brief: ContentBriefRecord) {
  return brief.articles[0] ?? null;
}

export default function SavedBriefListItem({
  brief,
  isActive,
  isDeleting = false,
  onSelect,
  onDelete,
}: SavedBriefListItemProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const latestArticle = getLatestArticle(brief);

  return (
    <li
      className="group relative"
      onMouseLeave={() => setIsConfirmingDelete(false)}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'w-full rounded-lg border px-3 py-3 pr-10 text-left transition-all',
          isActive
            ? 'border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-800 dark:bg-emerald-950'
            : 'border-transparent bg-transparent hover:border-border hover:bg-muted'
        )}
      >
        <p className="truncate text-sm font-medium text-foreground">{brief.targetKeyword}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {format(new Date(brief.createdAt), 'MMM d, yyyy · h:mm a')}
        </p>
        {latestArticle ? (
          <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            Draft ready
          </span>
        ) : (
          <span className="mt-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            No draft
          </span>
        )}
      </button>

      <button
        type="button"
        disabled={isDeleting}
        aria-label={
          isConfirmingDelete
            ? `Confirm delete ${brief.targetKeyword}`
            : `Delete ${brief.targetKeyword}`
        }
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();

          if (isConfirmingDelete) {
            onDelete(brief.id);
            setIsConfirmingDelete(false);
            return;
          }

          setIsConfirmingDelete(true);
        }}
        className={cn(
          'absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition-all',
          isConfirmingDelete
            ? 'bg-red-50 opacity-100 dark:bg-red-950/50'
            : 'text-muted-foreground opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-400',
          isActive && !isConfirmingDelete && 'opacity-100',
          isConfirmingDelete && 'hover:bg-red-100 dark:hover:bg-red-950/60'
        )}
      >
        {isDeleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : isConfirmingDelete ? (
          <Check size={14} className="text-red-500 dark:text-red-400" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
    </li>
  );
}
