import { getImpersonationState } from '@/lib/admin/impersonation';
import ImpersonationBannerClient from '@/components/admin/ImpersonationBannerClient';

export default async function ImpersonationBanner() {
  const state = await getImpersonationState();
  if (!state) return null;

  return <ImpersonationBannerClient email={state.targetEmail} />;
}
