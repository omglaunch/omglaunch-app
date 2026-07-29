import { getSystemConfig } from '@/app/actions/admin';
import AdminAiConfigClient from '@/components/admin/AdminAiConfigClient';

export default async function AdminAiConfigPage() {
  const { config, isSuperAdmin } = await getSystemConfig();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Engine & API Infrastructure</h1>
        <p className="text-muted-foreground">
          System-wide LLM configuration, circuit breakers, and master key vault
        </p>
      </div>

      <AdminAiConfigClient config={config} isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
