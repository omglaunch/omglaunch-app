'use client';

import { Badge } from '@/components/ui/badge';
import { useAnalysis } from '@/components/analysis/AnalysisProvider';
import { isJsonLdValid } from '@/lib/analysis-state';
import { cn } from '@/lib/utils';

type PageAuditJsonLdBadgeProps = {
  url: string;
  keyword: string;
};

export default function PageAuditJsonLdBadge({ url, keyword }: PageAuditJsonLdBadgeProps) {
  const { technicalData, matchesSession } = useAnalysis();

  if (!matchesSession(url, keyword) || !technicalData) {
    return null;
  }

  const isValid = isJsonLdValid(technicalData);
  if (isValid === null) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        isValid
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800'
      )}
    >
      JSON-LD {isValid ? 'Valid' : 'Missing / Invalid'}
    </Badge>
  );
}
