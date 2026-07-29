'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SudoDialog from '@/components/admin/SudoDialog';
import { forceKillQueueTask } from '@/app/actions/admin';
import { toast } from '@/components/ui/sonner';
import { AlertTriangle } from 'lucide-react';

interface QueueTask {
  id: string;
  userId: string;
  taskType: string;
  state: string;
  startedAt: Date;
  durationMs: number;
}

interface AdminQueuesClientProps {
  tasks: QueueTask[];
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes < 60) return `${minutes}m ${rem}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function stateBadge(state: string) {
  switch (state) {
    case 'STUCK':
      return <Badge variant="destructive">Stuck</Badge>;
    case 'RUNNING':
      return <Badge className="bg-blue-500 hover:bg-blue-500">Running</Badge>;
    default:
      return <Badge variant="secondary">{state}</Badge>;
  }
}

export default function AdminQueuesClient({ tasks }: AdminQueuesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sudoOpen, setSudoOpen] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  async function handleForceKill(taskId: string) {
    try {
      await forceKillQueueTask(taskId);
      toast.success('Task force-killed and state reset');
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.message === 'SUDO_REQUIRED') {
        setPendingTaskId(taskId);
        setSudoOpen(true);
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to kill task');
      }
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Active Tasks
            {tasks.some(t => t.state === 'STUCK') && (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Task Type</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No active background tasks
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map(task => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono text-xs">{task.userId}</TableCell>
                      <TableCell>{task.taskType}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(task.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{stateBadge(task.state)}</TableCell>
                      <TableCell>{formatDuration(task.durationMs)}</TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isPending}
                          onClick={() => {
                            setPendingTaskId(task.id);
                            setSudoOpen(true);
                          }}
                        >
                          Force Kill / Reset
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SudoDialog
        open={sudoOpen}
        onOpenChange={setSudoOpen}
        onVerified={() => {
          if (pendingTaskId) handleForceKill(pendingTaskId);
        }}
        title="Confirm Force Kill"
        description="This will clear stuck database locks on the generation queue. Requires sudo verification."
      />
    </>
  );
}
