'use client';

import { useAnalysis } from '@/components/analysis/AnalysisProvider';
import { getReadabilityScore } from '@/lib/analysis-state';
import { cn } from '@/lib/utils';

type PageAuditReadabilityCardProps = {
  url: string;
  keyword: string;
};

export default function PageAuditReadabilityCard({ url, keyword }: PageAuditReadabilityCardProps) {
  const { technicalData, matchesSession } = useAnalysis();

  if (!matchesSession(url, keyword) || !technicalData) {
    return null;
  }

  const readability = getReadabilityScore(technicalData);
  if (readability === null) {
    return null;
  }

  return (
    <div className="px-6 py-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Readability</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          readability >= 80 ? 'text-emerald-600' : readability >= 60 ? 'text-amber-600' : 'text-red-600'
        )}
      >
        {readability}%
      </p>
      <p className="mt-1 text-xs text-gray-500">Content easy to read check</p>
    </div>
  );
}
