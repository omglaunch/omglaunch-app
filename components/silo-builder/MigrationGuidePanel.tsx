'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Crosshair, Network, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SILO_COMPETITOR_ATTACK_CREDIT_COST,
  SILO_CONTENT_GENERATION_CREDIT_COST,
  SILO_KEYWORD_MAP_CREDIT_COST,
} from '@/lib/silo-builder/constants';

const DISMISS_STORAGE_KEY = 'omglaunch-silo-migration-guide-dismissed';

type MigrationGuidePanelProps = {
  onSelectTab: (tab: 'keyword' | 'competitor') => void;
};

type MappingRow = {
  legacy: string;
  now: string;
  action?: 'keyword' | 'competitor';
};

const MAPPING_ROWS: MappingRow[] = [
  {
    legacy: 'Hub & Spoke (2-field keyword silo)',
    now: 'Keyword tab → Quick mode',
    action: 'keyword',
  },
  {
    legacy: 'Competitor Intel reverse-engineer',
    now: 'Competitor tab',
    action: 'competitor',
  },
  {
    legacy: 'Semantic gaps panel',
    now: 'Competitor workspace after generation',
    action: 'competitor',
  },
  {
    legacy: 'Bulk briefs to Article Studio (0 credits)',
    now: 'Workspace → Send briefs to Article Studio',
  },
  {
    legacy: 'Full articles + WordPress',
    now: `Content Factory (${SILO_CONTENT_GENERATION_CREDIT_COST} credits/article)`,
  },
  {
    legacy: 'Saved Hub & Spoke / Competitor Intel maps',
    now: 'Open the legacy tool → Continue in Silo Builder',
  },
];

export default function MigrationGuidePanel({ onSelectTab }: MigrationGuidePanelProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISS_STORAGE_KEY) !== '1');
    } catch {
      setVisible(true);
    }
  }, []);

  function handleDismiss() {
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // Ignore storage failures — still hide for this session.
    }
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-indigo-800 dark:bg-indigo-950 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-emerald-950 dark:text-indigo-50">
            Coming from Hub &amp; Spoke or Competitor Intel?
          </p>
          <p className="max-w-2xl text-xs leading-relaxed text-emerald-800 dark:text-zinc-200 sm:text-sm">
            Those workflows now live here. Map generation costs{' '}
            {SILO_KEYWORD_MAP_CREDIT_COST} credits (keyword) or {SILO_COMPETITOR_ATTACK_CREDIT_COST}{' '}
            credits (competitor). Import existing maps from the legacy tool with{' '}
            <span className="font-semibold text-emerald-950 dark:text-white">
              Continue in Silo Builder
            </span>
            .
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-950 dark:text-indigo-200 dark:hover:bg-indigo-900 dark:hover:text-white"
          onClick={handleDismiss}
          aria-label="Dismiss migration guide"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-emerald-200/80 bg-white dark:border-indigo-800 dark:bg-zinc-950">
        <div className="grid grid-cols-[1.1fr_1fr] gap-0 border-b border-emerald-100 bg-emerald-50/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:border-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-200 sm:px-4 sm:text-xs">
          <span>Legacy capability</span>
          <span>Where it lives now</span>
        </div>
        <ul className="divide-y divide-emerald-100 dark:divide-indigo-900">
          {MAPPING_ROWS.map(row => (
            <li
              key={row.legacy}
              className="grid grid-cols-[1.1fr_1fr] gap-2 px-3 py-2.5 text-xs sm:gap-3 sm:px-4 sm:text-sm"
            >
              <span className="text-zinc-600 dark:text-zinc-300">{row.legacy}</span>
              <span className="text-zinc-900 dark:text-zinc-50">
                {row.action ? (
                  <button
                    type="button"
                    onClick={() => onSelectTab(row.action!)}
                    className="inline-flex items-center gap-1 text-left font-medium text-emerald-700 hover:underline dark:text-indigo-300"
                  >
                    {row.now}
                    <ArrowRight className="h-3 w-3 shrink-0" />
                  </button>
                ) : (
                  row.now
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 dark:border-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-50 dark:hover:bg-indigo-900"
          onClick={() => onSelectTab('keyword')}
        >
          <Network className="h-3.5 w-3.5" />
          Open Keyword tab
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 dark:border-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-50 dark:hover:bg-indigo-900"
          onClick={() => onSelectTab('competitor')}
        >
          <Crosshair className="h-3.5 w-3.5" />
          Open Competitor tab
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          asChild
          className="gap-1.5 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950 dark:text-indigo-200 dark:hover:bg-indigo-900 dark:hover:text-white"
        >
          <Link href="/hub-and-spoke">
            Hub &amp; Spoke
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          asChild
          className="gap-1.5 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950 dark:text-indigo-200 dark:hover:bg-indigo-900 dark:hover:text-white"
        >
          <Link href="/dashboard/competitor-intel">
            Competitor Intel
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
