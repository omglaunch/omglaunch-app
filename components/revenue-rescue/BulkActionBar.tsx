'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Send, X } from 'lucide-react';

export default function BulkActionBar({
  count,
  destinationLabel,
  onSend,
  onClear,
}: {
  count: number;
  destinationLabel: string;
  onSend: () => void;
  onClear: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (count === 0 || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[200] flex justify-center px-4 pb-4 pointer-events-none',
        'md:pb-6'
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl',
          'border-zinc-200 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95',
          'animate-in fade-in slide-in-from-bottom-2 duration-200'
        )}
      >
        <p className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-200">
          <span className="font-semibold tabular-nums text-foreground">
            {count}
          </span>{' '}
          selected
        </p>
        <Button
          size="sm"
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
          onClick={onSend}
        >
          <Send className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            Send {count} to {destinationLabel}
          </span>
          <span className="sm:hidden">Send to {destinationLabel}</span>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>,
    document.body
  );
}
