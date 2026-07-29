export const poHeadingClass = 'text-foreground';
export const poSubheadingClass = 'text-gray-500 dark:text-muted-foreground';
export const poBodyClass = 'text-muted-foreground';
export const poMutedClass = 'text-gray-400 dark:text-muted-foreground';
export const poCardClass = 'border-border shadow-sm';
export const poLinkClass = 'text-blue-600 dark:text-blue-400';

export const PO_TABLE_WRAPPER =
  'competitor-audit-table w-full max-w-full overflow-x-auto overscroll-x-contain block whitespace-nowrap pb-4 rounded-lg border border-border';

export const PO_TABLE_HEADER_ROW = 'bg-muted/50';

export const PO_STICKY_HEAD_SHADOW =
  'shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.35)]';

export const PO_SEMANTIC_GAP_ENTITY_HEAD =
  'semantic-gap-entity-col sticky left-0 z-20 border-r border-border bg-muted shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.35)] whitespace-normal break-words text-wrap w-[130px] max-w-[130px] text-xs leading-snug align-top md:static md:z-auto md:w-[32%] md:max-w-none md:border-r-0 md:shadow-none md:text-sm';

export const PO_SEMANTIC_GAP_ENTITY_CELL =
  'semantic-gap-entity-col sticky left-0 z-10 border-r border-border bg-card shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.35)] whitespace-normal break-words text-wrap w-[130px] max-w-[130px] text-xs leading-snug align-top md:static md:z-auto md:w-[32%] md:max-w-none md:border-r-0 md:shadow-none md:text-sm';

export const PO_TECHNICAL_METRIC_HEAD =
  'technical-metric-col sticky left-0 z-20 border-r border-border bg-muted shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.35)] whitespace-normal break-words text-wrap w-[120px] max-w-[120px] text-xs leading-snug align-top md:static md:z-auto md:w-[28%] md:max-w-none md:border-r-0 md:shadow-none md:text-sm';

export const PO_TECHNICAL_METRIC_CELL =
  'technical-metric-col sticky left-0 z-10 border-r border-border bg-card shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.35)] whitespace-normal break-words text-wrap w-[120px] max-w-[120px] text-xs leading-snug align-top md:static md:z-auto md:w-[28%] md:max-w-none md:border-r-0 md:shadow-none md:text-sm';

export const PO_COMPARISON_PROGRESS_TRACK =
  'mt-1 inline-block h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-muted';

export const PO_STRATEGY_CODE_PILL_BASE =
  'px-1.5 py-0.5 mx-0.5 rounded font-mono text-xs font-semibold select-all border';

export const PO_STRATEGY_STEPS = [
  {
    title: 'Critical Gap Focus',
    accent:
      'border border-red-200 bg-red-50/80 text-red-900 dark:border-red-500/20 dark:bg-red-950/10 dark:text-red-200',
    titleClass: 'text-red-800 dark:text-red-200',
    bodyClass: 'text-sm leading-relaxed text-red-900/85 dark:text-red-200/90',
    iconBg: 'bg-red-600',
    codePillClass:
      'border-red-300 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-950/60 dark:text-red-300',
  },
  {
    title: 'Structural Recommendation',
    accent:
      'border border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200',
    titleClass: 'text-zinc-800 dark:text-zinc-200',
    bodyClass: 'text-sm leading-relaxed text-zinc-700 dark:text-zinc-200/90',
    iconBg: 'bg-zinc-600',
    codePillClass:
      'border-zinc-300 bg-zinc-200/80 text-zinc-800 dark:border-zinc-600/50 dark:bg-zinc-800/80 dark:text-zinc-300',
  },
  {
    title: 'Next Best Action',
    accent:
      'border border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/10 dark:text-emerald-200',
    titleClass: 'text-emerald-800 dark:text-emerald-200',
    bodyClass: 'text-sm leading-relaxed text-emerald-900/85 dark:text-emerald-200/80',
    iconBg: 'bg-emerald-600',
    codePillClass:
      'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
] as const;
