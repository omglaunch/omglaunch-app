import { Suspense } from 'react';
import AppMain from '@/components/layout/AppMain';
import SemanticAnalysisClient from './SemanticAnalysisClient';

export const dynamic = 'force-dynamic';

function SemanticAnalysisLoading() {
  return (
    <div className="flex min-h-[200px] items-center justify-center text-sm text-gray-500">
      Loading semantic analysis…
    </div>
  );
}

export default function SemanticAnalysisPage() {
  return (
    <AppMain>
      <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden p-4 sm:p-8">
        <Suspense fallback={<SemanticAnalysisLoading />}>
          <SemanticAnalysisClient />
        </Suspense>
      </div>
    </AppMain>
  );
}
