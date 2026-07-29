import { Suspense } from 'react';
import AppMain from '@/components/layout/AppMain';
import CompetitorCompareClient from './CompetitorCompareClient';

function PageOptimizerFallback() {
  return (
    <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      Loading Page Optimizer…
    </div>
  );
}

export default function PageOptimizerPage() {
  return (
    <AppMain>
      <div className="min-h-full min-w-0 w-full max-w-full overflow-x-hidden p-4 sm:p-8">
        <Suspense fallback={<PageOptimizerFallback />}>
          <CompetitorCompareClient />
        </Suspense>
      </div>
    </AppMain>
  );
}
