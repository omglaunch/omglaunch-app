import { guardAdminPage } from '@/lib/admin/rbac';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await guardAdminPage();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
