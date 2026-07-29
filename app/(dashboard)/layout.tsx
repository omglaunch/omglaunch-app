import { headers } from 'next/headers';
import DashboardShell from '@/components/layout/DashboardShell';
import { enforceViewerPageAccess } from '@/lib/projects/viewer-route-access';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get('x-pathname') ?? '';
  await enforceViewerPageAccess(pathname);

  return <DashboardShell>{children}</DashboardShell>;
}
