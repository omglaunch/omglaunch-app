import { Suspense } from 'react';
import AppMain from '@/components/layout/AppMain';
import SiloBuilderClient from './SiloBuilderClient';

export const dynamic = 'force-dynamic';

function SiloBuilderLoading() {
  return (
    <div className="flex min-h-[200px] flex-1 items-center justify-center text-sm text-muted-foreground">
      Loading Silo Builder…
    </div>
  );
}

export default function SiloBuilderPage() {
  return (
    <AppMain scrollable={false}>
      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto p-4 sm:p-8 lg:overflow-y-hidden">
        <Suspense fallback={<SiloBuilderLoading />}>
          <SiloBuilderClient />
        </Suspense>
      </div>
    </AppMain>
  );
}
