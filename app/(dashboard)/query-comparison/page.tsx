import { Suspense } from 'react';
import AppMain from '@/components/layout/AppMain';
import QueryComparisonClient from './QueryComparisonClient';

export const dynamic = 'force-dynamic';

function QueryComparisonFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-sm text-gray-500">Loading query comparison…</p>
    </div>
  );
}

export default function QueryComparisonPage() {
  return (
    <AppMain>
      <div className="min-h-full p-8">
        <Suspense fallback={<QueryComparisonFallback />}>
          <QueryComparisonClient />
        </Suspense>
      </div>
    </AppMain>
  );
}
