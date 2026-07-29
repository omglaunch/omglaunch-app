'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Users, TrendingUp, Flame } from 'lucide-react';

interface LogEntry {
  id: string;
  integrationType: string;
  status: string;
  httpStatus: number | null;
  latencyMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
}

interface AdminOverviewClientProps {
  metrics: {
    userCount: number;
    siloMarginIndex: number;
    inputTokens24h: number;
    outputTokens24h: number;
    failureRate: number;
    showHealthAlert: boolean;
    recentLogs: LogEntry[];
    tokenCosts: { input: number; output: number };
  };
}

function severityBadge(status: string) {
  switch (status) {
    case 'FAILURE':
      return <Badge variant="destructive">Failure</Badge>;
    case 'TIMEOUT':
      return <Badge className="bg-amber-500 hover:bg-amber-500">Timeout</Badge>;
    default:
      return <Badge variant="secondary">Success</Badge>;
  }
}

export default function AdminOverviewClient({ metrics }: AdminOverviewClientProps) {
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  return (
    <>
      {metrics.showHealthAlert && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>System Health Alert</AlertTitle>
          <AlertDescription>
            API/Webhook failure rate is {metrics.failureRate}% in the last hour (threshold: 10%).
            Investigate integration logs immediately.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Global User Count</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.userCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Registered workspaces</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Silo Margin Index</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.siloMarginIndex}%</div>
            <p className="text-xs text-muted-foreground">
              Gross margin (API spend vs credits consumed)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">LLM Token Burn Rate</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div>
                <div className="text-2xl font-bold">
                  {metrics.inputTokens24h.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Input (24h)</p>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {metrics.outputTokens24h.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Output (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Integration Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Integration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>HTTP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.recentLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No integration logs yet
                    </TableCell>
                  </TableRow>
                ) : (
                  metrics.recentLogs.map(log => (
                    <TableRow
                      key={log.id}
                      className={
                        log.status === 'FAILURE' ? 'cursor-pointer hover:bg-muted/80' : ''
                      }
                      onClick={() => {
                        if (log.status === 'FAILURE' && log.errorMessage) {
                          setErrorDialog({ open: true, message: log.errorMessage });
                        }
                      }}
                    >
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{log.integrationType}</TableCell>
                      <TableCell>{severityBadge(log.status)}</TableCell>
                      <TableCell>
                        {log.latencyMs != null ? `${log.latencyMs}ms` : '—'}
                      </TableCell>
                      <TableCell>{log.httpStatus ?? '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={errorDialog.open}
        onOpenChange={open => setErrorDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Raw Error Message</DialogTitle>
          </DialogHeader>
          <pre className="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-sm text-slate-100">
            {errorDialog.message}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
