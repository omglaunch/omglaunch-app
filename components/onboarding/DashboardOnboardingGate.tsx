'use client';

import SetupWizard from '@/components/onboarding/SetupWizard';

type DashboardOnboardingGateProps = {
  hasCompletedOnboarding: boolean;
  children: React.ReactNode;
};

export default function DashboardOnboardingGate({
  hasCompletedOnboarding,
  children,
}: DashboardOnboardingGateProps) {
  return (
    <>
      {children}
      <SetupWizard open={!hasCompletedOnboarding} />
    </>
  );
}
