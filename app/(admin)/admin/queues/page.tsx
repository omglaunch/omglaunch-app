import { getQueueTasks } from '@/app/actions/admin';
import AdminQueuesClient from '@/components/admin/AdminQueuesClient';

export default async function AdminQueuesPage() {
  const tasks = await getQueueTasks();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Background Queues</h1>
        <p className="text-muted-foreground">
          Monitor active generation tasks and force-reset stuck jobs
        </p>
      </div>

      <AdminQueuesClient tasks={tasks} />
    </div>
  );
}
