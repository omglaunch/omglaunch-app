'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { CheckCircle2, Clock3, Loader2, RefreshCw, Upload } from 'lucide-react';
import ManifestHostingPanel from '@/components/domain-profile/ManifestHostingPanel';
import ManifestPublishConfirmDialog from '@/components/domain-profile/ManifestPublishConfirmDialog';
import { toast } from '@/components/ui/sonner';
import {
  getDomainManifestApprovalState,
  listDomainManifestAuditLog,
  publishDomainManifestDraft,
  regenerateDomainManifestDraft,
  type DomainManifestActionResult,
  type DomainManifestAuditEntry,
} from '@/app/actions/domain-profile-manifest';
import { extractLatestWebhookDeliveryFromAudit } from '@/lib/domain-profile/manifest-webhook-shared';
import { useProject } from '@/components/projects/ProjectProvider';
import SettingsSection from '@/components/settings/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function DomainManifestTab() {
  const { activeProjectId, activeProject, isLoading: projectsLoading } = useProject();
  const [state, setState] = useState<DomainManifestActionResult | null>(null);
  const [auditLog, setAuditLog] = useState<DomainManifestAuditEntry[]>([]);
  const [draftPreview, setDraftPreview] = useState<Record<string, unknown> | null>(null);
  const [publishedPreview, setPublishedPreview] = useState<Record<string, unknown> | null>(null);
  const [hostingContext, setHostingContext] = useState<{
    projectDomain: string | null;
    primaryUrl: string | null;
    demoManifestUrl: string | null;
  }>({ projectDomain: null, primaryUrl: null, demoManifestUrl: null });
  const [loading, setLoading] = useState(true);
  const [isRegenerating, startRegenerate] = useTransition();
  const [isPublishing, startPublish] = useTransition();
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  const loadManifest = useCallback(async () => {
    if (!activeProjectId) {
      setState(null);
      setDraftPreview(null);
      setPublishedPreview(null);
      setHostingContext({ projectDomain: null, primaryUrl: null, demoManifestUrl: null });
      setAuditLog([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [approvalState, response, auditEntries] = await Promise.all([
        getDomainManifestApprovalState(activeProjectId),
        fetch(
          `/api/article-studio/domain-profile?projectId=${encodeURIComponent(activeProjectId)}`,
          { cache: 'no-store' }
        ),
        listDomainManifestAuditLog(activeProjectId),
      ]);

      if (!response.ok) {
        throw new Error('Failed to load manifest preview');
      }

      const payload = (await response.json()) as {
        draftManifest?: Record<string, unknown> | null;
        publishedManifest?: Record<string, unknown> | null;
        projectDomain?: string | null;
        primaryUrl?: string | null;
        demoManifestUrl?: string | null;
      };

      setState(approvalState);
      setDraftPreview(payload.draftManifest ?? null);
      setPublishedPreview(payload.publishedManifest ?? null);
      setHostingContext({
        projectDomain: payload.projectDomain ?? activeProject?.domain ?? null,
        primaryUrl: payload.primaryUrl ?? null,
        demoManifestUrl: payload.demoManifestUrl ?? null,
      });
      setAuditLog(auditEntries);
    } catch {
      toast.error('Failed to load domain manifest');
      setState(null);
      setDraftPreview(null);
      setPublishedPreview(null);
      setHostingContext({ projectDomain: null, primaryUrl: null, demoManifestUrl: null });
      setAuditLog([]);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  function handleRegenerateDraft() {
    if (!activeProjectId) return;

    startRegenerate(async () => {
      try {
        const result = await regenerateDomainManifestDraft(activeProjectId);
        setState(result);
        toast.success('Draft manifest regenerated');
        await loadManifest();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to regenerate draft');
      }
    });
  }

  function handlePublishDraft() {
    if (!activeProjectId || !draftPreview) return;
    setPublishConfirmOpen(true);
  }

  function confirmPublishDraft() {
    if (!activeProjectId) return;

    setPublishConfirmOpen(false);
    startPublish(async () => {
      try {
        const result = await publishDomainManifestDraft(activeProjectId);
        setState(result);
        toast.success('Domain manifest published to client endpoint');
        if (result.webhook && !result.webhook.skipped) {
          if (result.webhook.failed === 0) {
            toast.success(
              `Webhook delivered (${result.webhook.succeeded}/${result.webhook.attempted} OK)`
            );
          } else if (result.webhook.succeeded === 0) {
            toast.error(
              `Webhook delivery failed (${result.webhook.failed}/${result.webhook.attempted})`
            );
          } else {
            toast.warning(
              `Webhook partially delivered (${result.webhook.succeeded}/${result.webhook.attempted} OK)`
            );
          }
        }
        await loadManifest();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to publish manifest');
      }
    });
  }

  const latestWebhookDelivery = useMemo(() => {
    for (const entry of auditLog) {
      const webhook = extractLatestWebhookDeliveryFromAudit(entry.metadata);
      if (webhook) return webhook;
    }
    return state?.webhook ?? null;
  }, [auditLog, state?.webhook]);

  if (projectsLoading || loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading domain manifest…
      </div>
    );
  }

  if (!activeProjectId || !activeProject) {
    return (
      <SettingsSection
        title="Domain manifest approval"
        description="Review draft manifests before they go live on the client domain. This is the client's public entity profile — not your agency workspace brand."
      >
        <p className="text-sm text-muted-foreground">
          Select a project from the header to manage its domain manifest.
        </p>
      </SettingsSection>
    );
  }

  const hasPendingDraft = state?.hasPendingDraft ?? false;
  const isFirstPublish = (state?.publishedVersion ?? 0) === 0;
  const publishBlockers = state?.publishBlockers ?? [];
  const canPublish = Boolean(draftPreview) && publishBlockers.length === 0;

  return (
    <div className="space-y-6">
      <ManifestPublishConfirmDialog
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        projectName={activeProject.name}
        draftVersion={state?.draftVersion ?? 0}
        publishedVersion={state?.publishedVersion ?? 0}
        isFirstPublish={isFirstPublish}
        onConfirm={confirmPublishDraft}
      />
      <SettingsSection
        title="Domain manifest approval"
        description={`Review and publish the AIDD manifest for "${activeProject.name}". This is the client's public entity profile — not your agency workspace brand.`}
      >
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          Reports and exports use the <strong>published</strong> client brand from this manifest.
          Draft changes stay internal until you publish to the client domain.
        </p>
        {publishBlockers.length > 0 ? (
          <div className="mt-3 rounded-lg border border-red-200/80 bg-red-50/60 px-3 py-2 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
            <p className="font-medium">Publish blocked — complete NAP for this entity type:</p>
            <ul className="mt-1 list-disc pl-4">
              {publishBlockers.map(blocker => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
            <p className="mt-2">
              Update phone and address in{' '}
              <Link href="/settings?tab=aeo-brand" className="underline underline-offset-2">
                Settings → Client Brands
              </Link>
              , then regenerate the draft.
            </p>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {hasPendingDraft ? (
            <Badge
              variant="outline"
              className="gap-1 border-amber-200 text-amber-800 dark:border-amber-900 dark:text-amber-300"
            >
              <Clock3 className="h-3 w-3" />
              Draft pending approval
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"
            >
              <CheckCircle2 className="h-3 w-3" />
              Published · v{state?.publishedVersion ?? 0}
            </Badge>
          )}
          {state?.publishedAt ? (
            <span className="text-xs text-muted-foreground">
              Last published {new Date(state.publishedAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isRegenerating || isPublishing}
            onClick={handleRegenerateDraft}
          >
            {isRegenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Regenerating…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate draft
              </>
            )}
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            disabled={isRegenerating || isPublishing || !canPublish}
            onClick={handlePublishDraft}
          >
            {isPublishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Publish to client domain
              </>
            )}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/article-studio">Open Article Studio</Link>
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Draft version v{state?.draftVersion ?? 0}
          {hasPendingDraft ? ' · differs from published' : ' · matches published'}
        </p>
      </SettingsSection>

      <ManifestHostingPanel
        projectId={activeProjectId}
        projectDomain={hostingContext.projectDomain ?? activeProject.domain}
        primaryUrl={hostingContext.primaryUrl}
        publishedManifest={publishedPreview}
        isPublished={(state?.publishedVersion ?? 0) > 0}
        demoUrl={hostingContext.demoManifestUrl}
        publishedVersion={state?.publishedVersion ?? 0}
        webhookDelivery={latestWebhookDelivery}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ManifestPreviewCard
          title="Draft manifest"
          subtitle="Preview before publish"
          manifest={draftPreview}
          tone="draft"
        />
        <ManifestPreviewCard
          title="Published manifest"
          subtitle="Live on client domain"
          manifest={publishedPreview}
          tone="published"
        />
      </div>

      <SettingsSection
        title="Change history"
        description="Brand profile and domain manifest events for this client project."
      >
        {auditLog.length === 0 ? (
          <p className="text-sm text-muted-foreground">No brand or manifest changes recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map(entry => (
                  <tr key={entry.id} className="border-t border-border align-top">
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-foreground">{entry.action}</div>
                      {entry.category ? (
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {entry.category}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      <div>{entry.actorName}</div>
                      <div className="text-xs">{entry.actorEmail}</div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{entry.details ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}

function ManifestPreviewCard({
  title,
  subtitle,
  manifest,
  tone,
}: {
  title: string;
  subtitle: string;
  manifest: Record<string, unknown> | null;
  tone: 'draft' | 'published';
}) {
  const formatted = manifest ? JSON.stringify(manifest, null, 2) : null;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className={cn(
          'border-b border-border px-4 py-3',
          tone === 'draft' ? 'bg-amber-50/60 dark:bg-amber-950/20' : 'bg-emerald-50/60 dark:bg-emerald-950/20'
        )}
      >
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <ScrollArea className="h-[420px]">
        <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground">
          <code>{formatted ?? 'No manifest yet.'}</code>
        </pre>
      </ScrollArea>
    </div>
  );
}
