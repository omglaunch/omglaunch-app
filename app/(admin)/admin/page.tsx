import { getAdminOverviewMetrics } from '@/app/actions/admin';
import AdminOverviewClient from '@/components/admin/AdminOverviewClient';

export default async function AdminOverviewPage() {
  const metrics = await getAdminOverviewMetrics();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Command Overview</h1>
        <p className="text-muted-foreground">
          Platform-wide analytics and system health monitoring
        </p>
      </div>

      <AdminOverviewClient metrics={metrics} />
    </div>
  );
}
