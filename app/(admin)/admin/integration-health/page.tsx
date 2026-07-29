import { getIntegrationHealthLogs } from '@/app/actions/admin';
import AdminIntegrationHealthClient from '@/components/admin/AdminIntegrationHealthClient';

export default async function AdminIntegrationHealthPage({
  searchParams,
}: {
  searchParams: { page?: string; type?: string; status?: string };
}) {
  const page = Number(searchParams.page) || 1;
  const data = await getIntegrationHealthLogs({
    page,
    type: searchParams.type,
    status: searchParams.status,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integration Status Diagnostic</h1>
        <p className="text-muted-foreground">
          Monitor connection health, latency, and webhook failures
        </p>
      </div>

      <AdminIntegrationHealthClient initialData={data} />
    </div>
  );
}
