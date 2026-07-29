'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import AuditHistory, { type AuditHistoryItem } from '@/components/local-dominance/AuditHistory';
import GeogridIntelTab from '@/components/local-dominance/GeogridIntelTab';
import ServiceAreaFactoryTab from '@/components/local-dominance/ServiceAreaFactoryTab';
import ReviewCitationHubTab from '@/components/local-dominance/ReviewCitationHubTab';
import type { SavedGeogridAudit } from '@/lib/local-dominance/map-audit-result';
import { useProject } from '@/components/projects/ProjectProvider';
import { useTeamAccess } from '@/components/team/TeamAccessProvider';
import { useClientBrand } from '@/hooks/useClientBrand';

export default function LocalDominanceClient() {
  const { activeProjectId, isLoading: projectsLoading } = useProject();
  const { canWrite, agencyName } = useTeamAccess();
  const { brandLabel } = useClientBrand();
  const [audits, setAudits] = useState<AuditHistoryItem[]>([]);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState<string>();
  const [loadedAudit, setLoadedAudit] = useState<SavedGeogridAudit | null>(null);
  const [loadingAuditId, setLoadingAuditId] = useState<string | null>(null);
  const [deletingAuditId, setDeletingAuditId] = useState<string | null>(null);
  const [auditPendingDelete, setAuditPendingDelete] = useState<AuditHistoryItem | null>(null);

  const loadHistory = useCallback(async () => {
    if (!activeProjectId) {
      setAudits([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/local-dominance/geogrid/history?projectId=${encodeURIComponent(activeProjectId)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load history');
      }
      setAudits(data.audits ?? []);
    } catch {
      setAudits([]);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (projectsLoading) return;
    void loadHistory();
    setSelectedAuditId(undefined);
    setLoadedAudit(null);
  }, [loadHistory, projectsLoading]);

  async function handleSelectAudit(audit: AuditHistoryItem) {
    setSelectedAuditId(audit.id);
    setLoadingAuditId(audit.id);

    try {
      const response = await fetch(`/api/local-dominance/geogrid/history/${audit.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load audit');
      }

      setLoadedAudit(data as SavedGeogridAudit);
    } catch (error) {
      setLoadedAudit(null);
      toast.error(error instanceof Error ? error.message : 'Failed to load audit');
    } finally {
      setLoadingAuditId(null);
    }
  }

  async function handleDeleteAudit(audit: AuditHistoryItem) {
    setDeletingAuditId(audit.id);

    try {
      const response = await fetch(`/api/local-dominance/geogrid/history/${audit.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to delete audit');
      }

      setAudits(current => current.filter(item => item.id !== audit.id));
      if (selectedAuditId === audit.id) {
        setSelectedAuditId(undefined);
        setLoadedAudit(null);
      }

      toast.success('Audit removed from history');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete audit');
    } finally {
      setDeletingAuditId(null);
      setAuditPendingDelete(null);
    }
  }

  const locationScores = audits
    .map(a => a.solvScore)
    .filter((s): s is number => s != null);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-zinc-200 px-4 py-4 dark:border-slate-800 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-blue-600/20">
            <MapPin className="h-5 w-5 text-emerald-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-slate-100 sm:text-xl">
              Local Dominance
            </h1>
            <p className="text-xs text-zinc-500 dark:text-slate-400 sm:text-sm">
              {brandLabel ? (
                <>
                  Geogrid reports for <span className="font-medium text-foreground">{brandLabel}</span>
                  {!canWrite ? ' · read-only' : ''}
                </>
              ) : (
                'Geogrid tracking, service area generation, and citation management'
              )}
            </p>
            {brandLabel ? (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Prepared by {agencyName} · client brand, not agency workspace name
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {!activeProjectId ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
          Select a client project to view Local Dominance reports.
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:overflow-y-auto">
            <Tabs defaultValue="geogrid" className="min-w-0 space-y-4 sm:space-y-6">
              <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <TabsList className="inline-flex h-auto min-w-full flex-nowrap gap-1 border border-zinc-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 sm:min-w-0">
                  <TabsTrigger
                    value="geogrid"
                    className="shrink-0 px-2.5 py-1.5 text-xs text-zinc-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white dark:text-slate-300 dark:data-[state=active]:bg-blue-600 sm:px-3 sm:text-sm"
                  >
                    <span className="sm:hidden">Geogrid</span>
                    <span className="hidden sm:inline">Geogrid Intel</span>
                  </TabsTrigger>
                  {canWrite ? (
                    <>
                      <TabsTrigger
                        value="factory"
                        className="shrink-0 px-2.5 py-1.5 text-xs text-zinc-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white dark:text-slate-300 dark:data-[state=active]:bg-blue-600 sm:px-3 sm:text-sm"
                      >
                        <span className="sm:hidden">Factory</span>
                        <span className="hidden sm:inline">Service Area Factory</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="reviews"
                        className="shrink-0 px-2.5 py-1.5 text-xs text-zinc-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white dark:text-slate-300 dark:data-[state=active]:bg-blue-600 sm:px-3 sm:text-sm"
                      >
                        <span className="sm:hidden">Reviews</span>
                        <span className="hidden sm:inline">Review & Citation Hub</span>
                      </TabsTrigger>
                    </>
                  ) : null}
                </TabsList>
              </div>

              <TabsContent value="geogrid">
                <GeogridIntelTab
                  projectId={activeProjectId}
                  canWrite={canWrite}
                  defaultBusinessName={brandLabel}
                  onAuditComplete={loadHistory}
                  locationScores={locationScores}
                  selectedAuditId={selectedAuditId}
                  loadedAudit={loadedAudit}
                  isLoadingAudit={loadingAuditId != null}
                  onAuditRunComplete={auditId => {
                    setSelectedAuditId(auditId);
                    setLoadedAudit(null);
                  }}
                />
              </TabsContent>
              {canWrite ? (
                <>
                  <TabsContent value="factory">
                    <ServiceAreaFactoryTab />
                  </TabsContent>
                  <TabsContent value="reviews">
                    <ReviewCitationHubTab />
                  </TabsContent>
                </>
              ) : null}
            </Tabs>
          </main>

          <AuditHistory
            audits={audits}
            selectedId={selectedAuditId}
            loadingId={loadingAuditId}
            deletingId={deletingAuditId}
            onSelect={audit => void handleSelectAudit(audit)}
            onDelete={canWrite ? audit => setAuditPendingDelete(audit) : undefined}
            collapsed={historyCollapsed}
            onToggleCollapse={() => setHistoryCollapsed(prev => !prev)}
          />
        </div>
      )}

      <AlertDialog
        open={auditPendingDelete != null}
        onOpenChange={open => {
          if (!open && !deletingAuditId) {
            setAuditPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent className="border-zinc-200 bg-white text-zinc-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this audit?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500 dark:text-slate-400">
              {auditPendingDelete ? (
                <>
                  This will permanently remove the audit for{' '}
                  <span className="font-medium text-zinc-800 dark:text-slate-200">
                    &ldquo;{auditPendingDelete.keyword}&rdquo;
                  </span>{' '}
                  from {new Date(auditPendingDelete.createdAt).toLocaleDateString()}. This action
                  cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletingAuditId != null}
              className="border-zinc-300 bg-transparent text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingAuditId != null}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
              onClick={event => {
                event.preventDefault();
                if (auditPendingDelete) {
                  void handleDeleteAudit(auditPendingDelete);
                }
              }}
            >
              {deletingAuditId ? 'Deleting…' : 'Delete audit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
