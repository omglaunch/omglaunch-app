import { redirect } from 'next/navigation';
import AppMain from '@/components/layout/AppMain';
import CommandCenterClient from '@/components/dashboard/CommandCenterClient';
import DashboardOnboardingGate from '@/components/onboarding/DashboardOnboardingGate';
import { getOnboardingState } from '@/app/actions/onboarding';
import { getCommandCenterData } from '@/lib/dashboard/command-center';
import { countLegacyWorkspaceRecords } from '@/lib/migration/legacy-workspace';
import { UnauthenticatedError } from '@/lib/projects/authenticated-workspace';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  try {
    const [data, legacyRecordCount, onboarding] = await Promise.all([
      getCommandCenterData(),
      countLegacyWorkspaceRecords(),
      getOnboardingState(),
    ]);

    const hasCompletedOnboarding = onboarding?.hasCompletedOnboarding ?? true;

    return (
      <AppMain>
        <DashboardOnboardingGate hasCompletedOnboarding={hasCompletedOnboarding}>
          <div className="min-h-full p-6 md:p-8">
            <CommandCenterClient
              data={data}
              hasLegacyData={legacyRecordCount > 0}
            />
          </div>
        </DashboardOnboardingGate>
      </AppMain>
    );
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect('/login');
    }
    throw error;
  }
}
