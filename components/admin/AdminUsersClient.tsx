'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SudoDialog from '@/components/admin/SudoDialog';
import {
  adjustUserCredits,
  batchAdjustCredits,
  batchToggleUserAccess,
  batchUpdateUserRole,
  exportUsersCsv,
  impersonateUser,
  toggleUserAccess,
  toggleUserByok,
  updateUserRole,
} from '@/app/actions/admin';
import { MoreHorizontal, Download, Search } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import type { PlatformRole } from '@/lib/admin/rbac';

interface UserRow {
  id: string;
  name: string;
  email: string;
  credits: number;
  role: string;
  isActive: boolean;
  byokEnabled: boolean;
  createdAt: Date;
}

interface AdminUsersClientProps {
  initialData: {
    users: UserRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

type PendingAction =
  | { type: 'credits'; userId: string }
  | { type: 'impersonate'; userId: string }
  | { type: 'byok'; userId: string; enabled: boolean }
  | { type: 'batch-credits' }
  | { type: 'batch-role' }
  | { type: 'batch-access' }
  | null;

function generateUUID() {
  return crypto.randomUUID();
}

export default function AdminUsersClient({ initialData }: AdminUsersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sudoOpen, setSudoOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const [creditDialog, setCreditDialog] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditComment, setCreditComment] = useState('');
  const [batchRoleDialog, setBatchRoleDialog] = useState(false);
  const [batchRole, setBatchRole] = useState<PlatformRole>('USER');

  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? 'all';
  const page = initialData.page;

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/admin/users?${params.toString()}`);
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === initialData.users.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(initialData.users.map(u => u.id)));
    }
  };

  const requestSudo = (action: PendingAction) => {
    setPendingAction(action);
    setSudoOpen(true);
  };

  const executePendingAction = useCallback(async () => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === 'credits') {
        setCreditDialog(true);
        return;
      }
      if (pendingAction.type === 'impersonate') {
        startTransition(() => impersonateUser({ userId: pendingAction.userId }));
        return;
      }
      if (pendingAction.type === 'byok') {
        await toggleUserByok({ userId: pendingAction.userId, enabled: pendingAction.enabled });
        toast.success('BYOK setting updated');
        router.refresh();
        return;
      }
      if (pendingAction.type === 'batch-credits') {
        setCreditDialog(true);
        return;
      }
      if (pendingAction.type === 'batch-role') {
        setBatchRoleDialog(true);
        return;
      }
      if (pendingAction.type === 'batch-access') {
        await batchToggleUserAccess({ userIds: Array.from(selected), isActive: false });
        toast.success('Access toggled for selected users');
        setSelected(new Set());
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  }, [pendingAction, selected, router, startTransition]);

  async function handleCreditSubmit() {
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || !creditComment.trim()) {
      toast.error('Amount and comment are required');
      return;
    }

    const idempotencyKey = generateUUID();

    try {
      if (pendingAction?.type === 'credits') {
        await adjustUserCredits({
          userId: pendingAction.userId,
          amount,
          comment: creditComment,
          idempotencyKey,
        });
        toast.success('Credits adjusted');
      } else if (pendingAction?.type === 'batch-credits') {
        await batchAdjustCredits({
          userIds: Array.from(selected),
          amount,
          comment: creditComment,
          idempotencyKey,
        });
        toast.success('Batch credits adjusted');
        setSelected(new Set());
      }
      setCreditDialog(false);
      setCreditAmount('');
      setCreditComment('');
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.message === 'SUDO_REQUIRED') {
        setSudoOpen(true);
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to adjust credits');
      }
    }
  }

  async function handleBatchRoleSubmit() {
    try {
      await batchUpdateUserRole({ userIds: Array.from(selected), role: batchRole });
      toast.success('Roles updated');
      setBatchRoleDialog(false);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update roles');
    }
  }

  async function handleExport() {
    try {
      const csv = await exportUsersCsv(search || undefined);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by email…"
            defaultValue={search}
            className="pl-9"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                updateParams({ search: (e.target as HTMLInputElement).value, page: '1' });
              }
            }}
          />
        </div>
        <Select value={status} onValueChange={v => updateParams({ status: v, page: '1' })}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      <div className="w-full overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    initialData.users.length > 0 &&
                    selected.size === initialData.users.length
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>BYOK</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.users.map(user => (
              <TableRow key={user.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(user.id)}
                    onCheckedChange={() => toggleSelect(user.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.credits.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline">{user.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? 'secondary' : 'destructive'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>{user.byokEnabled ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => requestSudo({ type: 'credits', userId: user.id })}
                      >
                        Adjust Balances
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => requestSudo({ type: 'impersonate', userId: user.id })}
                      >
                        Impersonate User (God Mode)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          requestSudo({
                            type: 'byok',
                            userId: user.id,
                            enabled: !user.byokEnabled,
                          })
                        }
                      >
                        {user.byokEnabled ? 'Disable BYOK' : 'Enable BYOK'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={async () => {
                          try {
                            await updateUserRole({
                              userId: user.id,
                              role: user.role === 'USER' ? 'SUPPORT' : 'USER',
                            });
                            toast.success('Role updated');
                            router.refresh();
                          } catch {
                            requestSudo({ type: 'credits', userId: user.id });
                          }
                        }}
                      >
                        Toggle Role
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          try {
                            await toggleUserAccess({
                              userId: user.id,
                              isActive: !user.isActive,
                            });
                            toast.success('Access toggled');
                            router.refresh();
                          } catch {
                            requestSudo({ type: 'credits', userId: user.id });
                          }
                        }}
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {initialData.total} users · Page {page} of {initialData.totalPages || 1}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= initialData.totalPages}
            onClick={() => updateParams({ page: String(page + 1) })}
          >
            Next
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg border bg-background px-6 py-3 shadow-lg">
          <span className="text-sm font-medium">{selected.size} Users Selected</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => requestSudo({ type: 'batch-credits' })}
          >
            Batch Adjust Credits
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => requestSudo({ type: 'batch-role' })}
          >
            Batch Change RBAC Role
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => requestSudo({ type: 'batch-access' })}
          >
            Batch Toggle Access
          </Button>
        </div>
      )}

      <SudoDialog
        open={sudoOpen}
        onOpenChange={setSudoOpen}
        onVerified={executePendingAction}
      />

      <Dialog open={creditDialog} onOpenChange={setCreditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Credits</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount (positive to add, negative to revoke)</Label>
              <Input
                type="number"
                value={creditAmount}
                onChange={e => setCreditAmount(e.target.value)}
                placeholder="e.g. 100 or -50"
              />
            </div>
            <div className="space-y-2">
              <Label>Comment (required)</Label>
              <Textarea
                value={creditComment}
                onChange={e => setCreditComment(e.target.value)}
                placeholder="Reason for adjustment…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreditSubmit} disabled={isPending}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchRoleDialog} onOpenChange={setBatchRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Change Role</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={batchRole} onValueChange={v => setBatchRole(v as PlatformRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">USER</SelectItem>
                <SelectItem value="SUPPORT">SUPPORT</SelectItem>
                <SelectItem value="ADMIN">ADMIN</SelectItem>
                <SelectItem value="SUPER_ADMIN">SUPER_ADMIN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBatchRoleSubmit}>Apply to {selected.size} users</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
