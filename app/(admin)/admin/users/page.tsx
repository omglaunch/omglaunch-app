import { getAdminUsers } from '@/app/actions/admin';
import AdminUsersClient from '@/components/admin/AdminUsersClient';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string; status?: string };
}) {
  const page = Number(searchParams.page) || 1;
  const data = await getAdminUsers({
    page,
    search: searchParams.search,
    status: (searchParams.status as 'all' | 'active' | 'inactive') ?? 'all',
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Directory</h1>
        <p className="text-muted-foreground">
          Manage users, credits, roles, and impersonation
        </p>
      </div>

      <AdminUsersClient initialData={data} />
    </div>
  );
}
