'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { ClipboardCheck, Loader2, Search } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useProject } from '@/components/projects/ProjectProvider';
import { fetchRecentPageAudits, savePageAuditViaApi } from '@/lib/page-audit/client-api';
import type { RecentPageAudit } from '@/lib/page-audit/types';
import { useAnalysis } from '@/components/analysis/AnalysisProvider';
import AnalysisLocationSelect from '@/components/analysis/AnalysisLocationSelect';
import { DEFAULT_SEMANTIC_LOCATION_CODE } from '@/lib/analysis-state';
import { parseAuditData } from '@/lib/audit-data';
import { useToolHistory } from '@/hooks/useToolHistory';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageAuditHistoryRow from './PageAuditHistoryRow';

export default function PageAuditClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeProjectId } = useProject();
  const { setSession, auditReportData, setAuditReportData, runTechnicalAnalysis } = useAnalysis();
  const { remove: removeHistoryEntry } = useToolHistory('page-audit', {
    limit: 10,
    workspaceId: activeProjectId,
  });
  const [isPending, startTransition] = useTransition();
  const [audits, setAudits] = useState<RecentPageAudit[]>([]);
  const [isLoadingAudits, setIsLoadingAudits] = useState(false);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [auditPendingDelete, setAuditPendingDelete] = useState<RecentPageAudit | null>(null);
  const [url, setUrl] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(DEFAULT_SEMANTIC_LOCATION_CODE);
  const [error, setError] = useState<string | null>(null);

  const loadAudits = useCallback(async () => {
    if (!(activeProjectId ?? "").trim()) {
      setAudits([]);
      return;
    }

    setIsLoadingAudits(true);
    try {
      const nextAudits = await fetchRecentPageAudits(activeProjectId);
      setAudits(nextAudits);
    } catch {
      setAudits([]);
    } finally {
      setIsLoadingAudits(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    setAudits([]);
    setUrl('');
    setTargetKeyword('');
    setError(null);
  }, [activeProjectId]);

  useEffect(() => {
    void loadAudits();
  }, [loadAudits]);

  async function handleDeleteAudit(audit: RecentPageAudit) {
    setDeletingHistoryId(audit.historyId);

    try {
      await removeHistoryEntry(audit.historyId);

      const activeReportId = pathname.match(/\/page-audit\/([^/]+)/)?.[1];
      const deletedMatchesActive =
        activeReportId === String(audit.id) ||
        auditReportData?.id === audit.id;

      if (deletedMatchesActive) {
        setAuditReportData(null);
        if (pathname.startsWith('/page-audit/')) {
          router.push('/page-audit');
        }
      }

      await loadAudits();
      toast.success('Audit deleted.');
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete audit.'
      );
    } finally {
      setDeletingHistoryId(null);
      setAuditPendingDelete(null);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedUrl = url.trim();
    const trimmedKeyword = targetKeyword.trim();

    if (!trimmedUrl || !trimmedKeyword) {
      setError('Please enter both a URL and target keyword.');
      return;
    }

    startTransition(async () => {
      try {
        setSession(trimmedUrl, trimmedKeyword, selectedLocation);

        const [audit] = await Promise.all([
          savePageAuditViaApi({
            url: trimmedUrl,
            targetKeyword: trimmedKeyword,
            workspaceId: activeProjectId,
          }),
          runTechnicalAnalysis(trimmedUrl, trimmedKeyword, selectedLocation),
        ]);

        const data = parseAuditData(audit.auditData);
        setAuditReportData({
          id: audit.id,
          url: audit.url,
          targetKeyword: audit.targetKeyword,
          geoScore: audit.geoScore,
          createdAt: audit.createdAt,
          data,
        });

        router.push(`/page-audit/${audit.id}`);
      } catch {
        setError('Failed to run audit. Check the URL and try again.');
      }
    });
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="mb-6 min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 shadow-sm dark:bg-blue-600">
            <ClipboardCheck className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">Page Audit</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Analyze page structure, content signals, and AI-readiness for any URL.
            </p>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-5">
          <Card className="min-w-0 border-border shadow-sm xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Run Audit</CardTitle>
              <CardDescription>
                Enter a page URL and target keyword to scrape and audit the page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com/page"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isPending}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetKeyword">Target Keyword</Label>
                  <Input
                    id="targetKeyword"
                    type="text"
                    placeholder="e.g. best running shoes"
                    value={targetKeyword}
                    onChange={(e) => setTargetKeyword(e.target.value)}
                    disabled={isPending}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <AnalysisLocationSelect
                    id="region"
                    value={selectedLocation}
                    onChange={setSelectedLocation}
                    disabled={isPending}
                    className="w-full"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600" role="alert">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-blue-600 dark:hover:bg-blue-700"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running Audit…
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Run Audit
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-border shadow-sm xl:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">Recent Audits</CardTitle>
              <CardDescription>
                Latest 10 page audits saved to your workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAudits ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading audits…
                </div>
              ) : audits.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 py-12 text-center">
                  <ClipboardCheck className="mb-3 h-8 w-8 text-gray-300" />
                  <p className="text-sm font-medium text-muted-foreground">No audits yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Run your first audit using the form.
                  </p>
                </div>
              ) : (
                <div className="max-h-[min(70vh,720px)] space-y-3 overflow-y-auto pr-1">
                  {audits.map(audit => (
                    <PageAuditHistoryRow
                      key={audit.historyId}
                      audit={audit}
                      isDeleting={deletingHistoryId === audit.historyId}
                      onNavigate={() => router.push(`/page-audit/${audit.id}`)}
                      onDelete={() => setAuditPendingDelete(audit)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      <AlertDialog
        open={auditPendingDelete != null}
        onOpenChange={open => {
          if (!open && !deletingHistoryId) {
            setAuditPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this audit?</AlertDialogTitle>
            <AlertDialogDescription>
              {auditPendingDelete ? (
                <>
                  This will permanently remove the audit for{' '}
                  <span className="font-medium text-foreground">
                    {auditPendingDelete.targetKeyword}
                  </span>{' '}
                  ({auditPendingDelete.url}) from your workspace. This action cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingHistoryId != null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingHistoryId != null}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
              onClick={event => {
                event.preventDefault();
                if (auditPendingDelete) {
                  void handleDeleteAudit(auditPendingDelete);
                }
              }}
            >
              {deletingHistoryId ? 'Deleting…' : 'Delete audit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
