import { Suspense } from 'react';
import AppMain from '@/components/layout/AppMain';
import CompetitorIntelClient from './CompetitorIntelClient';

export const dynamic = 'force-dynamic';

function CompetitorIntelLoading() {
  return (
    <div className="flex min-h-[200px] flex-1 items-center justify-center text-sm text-gray-500">
      Loading Competitor Intel…
    </div>
  );
}

export default function CompetitorIntelPage() {
  return (
    <AppMain scrollable={false}>
      <div className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-hidden p-4 sm:p-8">
        <Suspense fallback={<CompetitorIntelLoading />}>
          <CompetitorIntelClient />
        </Suspense>
      </div>
    </AppMain>
  );
}
