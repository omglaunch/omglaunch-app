'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import {
  acquirePortalZIndex,
  releasePortalZIndex,
} from '@/lib/ai-visibility/onboarding/z-index';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Option = { value: string; label: string };

type Props = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** CreatableSelect for Target Cluster */
  creatable?: boolean;
  /** Async search — for Geo Target */
  onSearch?: (q: string) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Windowed virtual dropdown via React Portal + context-aware z-index.
 */
export default function PortalVirtualSelect({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  creatable = false,
  onSearch,
  loading,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [z, setZ] = useState(80);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 240 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  const showCreate =
    creatable &&
    query.trim().length > 0 &&
    !filtered.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  const items = showCreate
    ? [{ value: `__create__:${query.trim()}`, label: `Create “${query.trim()}”` }, ...filtered]
    : filtered;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 36,
    overscan: 8,
  });

  useEffect(() => {
    if (!open) return;
    const zid = acquirePortalZIndex();
    setZ(zid);
    return () => releasePortalZIndex();
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 240),
    });
  }, [open]);

  useEffect(() => {
    if (!onSearch) return;
    const t = window.setTimeout(() => onSearch(query), 200);
    return () => window.clearTimeout(t);
  }, [query, onSearch]);

  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? (value || placeholder);

  function pick(opt: Option) {
    if (opt.value.startsWith('__create__:')) {
      onChange(opt.value.replace('__create__:', ''));
    } else {
      onChange(opt.value);
    }
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-8 w-full justify-between border-zinc-200 bg-white px-2 text-xs font-normal dark:border-zinc-800 dark:bg-zinc-950',
          className
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0"
              style={{ zIndex: z }}
              onMouseDown={() => setOpen(false)}
            >
              <div
                className="absolute overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
                style={{
                  top: coords.top,
                  left: coords.left,
                  width: coords.width,
                  zIndex: z + 1,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="border-b border-zinc-200 p-1.5 dark:border-zinc-800">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={creatable ? 'Search or create…' : 'Search…'}
                    className="h-8 border-zinc-200 text-xs dark:border-zinc-800"
                    autoFocus
                  />
                </div>
                <div ref={listRef} className="max-h-56 overflow-auto">
                  {loading ? (
                    <p className="p-3 text-xs text-muted-foreground">Loading…</p>
                  ) : items.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">No matches</p>
                  ) : (
                    <div
                      style={{
                        height: virtualizer.getTotalSize(),
                        position: 'relative',
                      }}
                    >
                      {virtualizer.getVirtualItems().map((v) => {
                        const opt = items[v.index]!;
                        const active = opt.value === value;
                        const isCreate = opt.value.startsWith('__create__:');
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={cn(
                              'absolute left-0 flex w-full items-center gap-2 px-2 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
                              active && 'bg-emerald-50 dark:bg-emerald-950/30'
                            )}
                            style={{
                              height: v.size,
                              transform: `translateY(${v.start}px)`,
                            }}
                            onClick={() => pick(opt)}
                          >
                            {isCreate ? (
                              <Plus className="h-3 w-3 text-emerald-600" />
                            ) : active ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <span className="h-3 w-3" />
                            )}
                            <span className="truncate">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
