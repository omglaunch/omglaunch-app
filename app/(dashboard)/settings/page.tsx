import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import AppMain from '@/components/layout/AppMain';
import SettingsClient from '@/components/settings/SettingsClient';
import { getSettingsBundle } from '@/app/actions/settings';
import { UnauthenticatedError } from '@/lib/projects/authenticated-workspace';

export const dynamic = 'force-dynamic';

function SettingsLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-4 w-96 max-w-full rounded-md bg-muted" />
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  );
}

export default async function SettingsPage() {
  try {
    const data = await getSettingsBundle();

    return (
      <AppMain>
        <div className="min-h-full p-6 md:p-8">
          <Suspense fallback={<SettingsLoading />}>
            <SettingsClient initialData={data} />
          </Suspense>
        </div>
      </AppMain>
    );
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect('/');
    }
    throw error;
  }
}
