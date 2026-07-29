import type { SiloNodeDto } from '@/lib/silo-builder/types';

export const siloKeywordClass = 'text-emerald-600 dark:text-indigo-300';
export const siloActionLinkClass = 'text-emerald-600 dark:text-blue-300';
export const siloBodyTextClass = 'text-zinc-600 dark:text-zinc-300';
export const siloSectionLabelClass = 'text-zinc-500 dark:text-zinc-400';
export const siloHeadingClass = 'text-zinc-900 dark:text-zinc-50';
export const siloSubheadingClass = 'text-zinc-500 dark:text-zinc-400';

export const siloMetaBadgeClass =
  'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300';
export const siloNeutralBadgeClass =
  'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300';
export const siloSpokeBadgeClass =
  'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300';
export const siloPillarBadgeClass =
  'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300';

export function siloStatusBadgeClass(status: SiloNodeDto['status']): string {
  switch (status) {
    case 'PUBLISHED':
      return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/50';
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50';
    case 'GENERATING':
    case 'QUEUED':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50';
    case 'FAILED':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300';
  }
}

export function siloStatusLabel(
  status: SiloNodeDto['status'],
  wpPostStatus?: SiloNodeDto['wpPostStatus']
): string {
  if (status === 'PUBLISHED') {
    return 'PUBLISHED';
  }
  if (status === 'COMPLETED' && wpPostStatus === 'draft') {
    return 'WP DRAFT';
  }
  return status;
}

export function siloFunnelStageClass(stage: string): string {
  const normalized = stage.toUpperCase();
  if (normalized.includes('TOFU') || normalized.includes('AWARENESS')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50';
  }
  if (normalized.includes('MOFU') || normalized.includes('CONSIDERATION')) {
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50';
  }
  if (normalized.includes('BOFU') || normalized.includes('DECISION')) {
    return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50';
  }
  return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300';
}
