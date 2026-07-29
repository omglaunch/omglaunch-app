'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HealthLog {
  id: string;
  workspaceId: string | null;
  integrationType: string;
  status: string;
  httpStatus: number | null;
  latencyMs: number | null;
  targetUrl: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

interface AdminIntegrationHealthClientProps {
  initialData: {
    logs: HealthLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

function statusBadge(status: string) {
  switch (status) {
    case 'FAILURE':
      return <Badge variant="destructive">Failure</Badge>;
    case 'TIMEOUT':
      return <Badge className="bg-amber-500 hover:bg-amber-500">Timeout</Badge>;
    default:
      return <Badge variant="secondary">Success</Badge>;
  }
}

export default function AdminIntegrationHealthClient({
  initialData,
}: AdminIntegrationHealthClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; log: HealthLog | null }>({
    open: false,
    log: null,
  });

  const type = searchParams.get('type') ?? 'all';
  const status = searchParams.get('status') ?? 'all';
  const page = initialData.page;

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/admin/integration-health?${params.toString()}`);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={type} onValueChange={v => updateParams({ type: v, page: '1' })}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Integration Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="DATAFORSEO">DataForSEO</SelectItem>
            <SelectItem value="WORDPRESS">WordPress</SelectItem>
            <SelectItem value="OPENAI">OpenAI</SelectItem>
            <SelectItem value="GEMINI">Gemini</SelectItem>
            <SelectItem value="WEBHOOK">Webhook</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={v => updateParams({ status: v, page: '1' })}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="SUCCESS">Success</SelectItem>
            <SelectItem value="FAILURE">Failure</SelectItem>
            <SelectItem value="TIMEOUT">Timeout</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Integration Transaction Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Target URL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialData.logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No integration logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  initialData.logs.map(log => (
                    <TableRow
                      key={log.id}
                      className={
                        log.status === 'FAILURE' ? 'cursor-pointer hover:bg-muted/80' : ''
                      }
                      onClick={() => {
                        if (log.status === 'FAILURE') {
                          setErrorDialog({ open: true, log });
                        }
                      }}
                    >
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{log.integrationType}</TableCell>
                      <TableCell>{statusBadge(log.status)}</TableCell>
                      <TableCell>
                        {log.latencyMs != null ? `${log.latencyMs}ms` : '—'}
                      </TableCell>
                      <TableCell>{log.httpStatus ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.workspaceId ?? '—'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">
                        {log.targetUrl ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {initialData.total} logs · Page {page} of {initialData.totalPages || 1}
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

      <Dialog
        open={errorDialog.open}
        onOpenChange={open => setErrorDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Webhook Failure Details</DialogTitle>
          </DialogHeader>
          {errorDialog.log && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Target URL:</span>
                  <p className="break-all font-mono">{errorDialog.log.targetUrl ?? 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Workspace ID:</span>
                  <p className="font-mono">{errorDialog.log.workspaceId ?? 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">HTTP Status:</span>
                  <p>{errorDialog.log.httpStatus ?? 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Latency:</span>
                  <p>{errorDialog.log.latencyMs != null ? `${errorDialog.log.latencyMs}ms` : 'N/A'}</p>
                </div>
              </div>
              <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-4 text-sm text-slate-100">
                {errorDialog.log.errorMessage ?? 'No error message recorded'}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
