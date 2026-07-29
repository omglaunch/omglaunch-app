'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { syncPromptText, setPendingPromptEdit } from '@/lib/ai-visibility/onboarding/store';

/**
 * Local component state + debounced / onBlur sync —
 * prevents keystroke lag and full staging table re-renders.
 */
export default function EditablePromptCell({
  id,
  value,
  hasError,
}: {
  id: string;
  value: string;
  hasError?: boolean;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (local !== value) {
        setPendingPromptEdit(id, local);
        syncPromptText(id, local);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [local, id, value]);

  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) syncPromptText(id, local);
      }}
      className={
        hasError
          ? 'h-8 border-amber-400/60 bg-amber-50 text-sm dark:border-amber-500/40 dark:bg-amber-950/20'
          : 'h-8 border-zinc-200 bg-transparent text-sm dark:border-zinc-800'
      }
    />
  );
}
