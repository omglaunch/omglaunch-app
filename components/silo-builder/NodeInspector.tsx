'use client';

import { useEffect, useState } from 'react';
import { Copy, Loader2, PenLine, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useProject } from '@/components/projects/ProjectProvider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import SiloMetricsConfidenceBadge from '@/components/silo-builder/SiloMetricsConfidenceBadge';
import type { SiloNodeDto } from '@/lib/silo-builder/types';
import { getMetricsFreshness } from '@/lib/silo-builder/metrics-freshness';
import {
  buildSiloArticleStudioHref,
  buildSiloBriefStudioHref,
} from '@/lib/silo-builder/article-studio-link';
import {
  siloActionLinkClass,
  siloBodyTextClass,
  siloFunnelStageClass,
  siloKeywordClass,
  siloMetaBadgeClass,
  siloNeutralBadgeClass,
  siloPillarBadgeClass,
  siloSectionLabelClass,
  siloStatusBadgeClass,
  siloStatusLabel,
} from '@/components/silo-builder/silo-theme';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

type NodeInspectorProps = {
  node: SiloNodeDto | null;
  projectId: string;
  projectTitle: string;
  geography?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNodeUpdated: (node: SiloNodeDto) => void;
  onRetryGeneration?: (nodeId: string) => Promise<void>;
};

function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return value.toLocaleString();
}

function htmlToPlainText(html: string): string {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  return (container.innerText || container.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function DraftInArticleStudioButton({
  node,
  projectId,
  projectTitle,
}: {
  node: SiloNodeDto;
  projectId: string;
  projectTitle: string;
}) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
    >
      <Link
        href={buildSiloBriefStudioHref({
          siloNodeId: node.id,
          siloProjectId: projectId,
          siloProjectTitle: projectTitle,
          title: node.title,
          targetKeyword: node.targetKeyword,
          intent: node.intent,
        })}
      >
        <PenLine className="h-3.5 w-3.5" />
        Draft in Article Studio
        <ArrowRight className="ml-auto h-3.5 w-3.5" />
      </Link>
    </Button>
  );
}

function GeneratedArticlePanel({
  node,
  articleStudioProjectId,
  onRetry,
  retrying,
}: {
  node: SiloNodeDto;
  articleStudioProjectId: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  async function handleCopyText() {
    if (!node.content) return;
    try {
      await navigator.clipboard.writeText(htmlToPlainText(node.content));
      toast.success('Article text copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  async function handleCopyHtml() {
    if (!node.content) return;
    try {
      await navigator.clipboard.writeText(node.content);
      toast.success('Article HTML copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  useEffect(() => {
    if (
      (node.status !== 'COMPLETED' && node.status !== 'PUBLISHED') ||
      !node.content?.trim() ||
      !articleStudioProjectId.trim()
    ) {
      return;
    }

    void fetch(`/api/silo-builder/nodes/${node.id}/sync-article-studio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleStudioProjectId }),
    }).catch(() => {
      // Best-effort backfill for articles generated before project-scoped sync.
    });
  }, [articleStudioProjectId, node.content, node.id, node.status]);

  if (node.status === 'QUEUED' || node.status === 'GENERATING') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Content Factory is generating this article</p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-200/90">
          In local dev this usually finishes in under a minute. If it stays stuck, use Retry
          generation below.
        </p>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
            className="mt-3 border-amber-300 bg-background text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40"
          >
            {retrying ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Retry generation
          </Button>
        )}
      </div>
    );
  }

  if (node.status === 'FAILED') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
        <p className="text-sm font-medium text-red-900 dark:text-red-100">Generation failed</p>
        <p className="mt-1 text-xs text-red-800 dark:text-red-200/90">
          The article could not be generated. Retry below or select the node and send to Content
          Factory again.
        </p>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
            className="mt-3 border-red-300 bg-background text-red-900 hover:bg-red-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
          >
            {retrying ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Retry generation
          </Button>
        )}
      </div>
    );
  }

  if (!node.content) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-[10px] font-semibold uppercase tracking-wide', siloSectionLabelClass)}>
          Generated Article
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 border-emerald-200 bg-emerald-50 text-xs text-emerald-700 hover:bg-emerald-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
          >
            <Link href={buildSiloArticleStudioHref(node)}>
              <PenLine className="h-3.5 w-3.5" />
              Edit in Article Studio
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCopyText()}
            className="h-7 gap-1.5 border-border text-xs"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy text
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCopyHtml()}
            className="h-7 gap-1.5 border-border text-xs"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy HTML
          </Button>
        </div>
      </div>

      {node.wpPostId ? (
        <p
          className={cn(
            'text-xs',
            node.status === 'PUBLISHED' || node.wpPostStatus === 'publish'
              ? 'text-emerald-700 dark:text-violet-300'
              : 'text-emerald-700 dark:text-emerald-300'
          )}
        >
          {node.status === 'PUBLISHED' || node.wpPostStatus === 'publish'
            ? `Live on WordPress (Post ID ${node.wpPostId}`
            : `WordPress draft (Post ID ${node.wpPostId}`}
          {node.slug ? ` · /${node.slug}` : ''})
          {node.publishedAt
            ? ` · Published ${new Date(node.publishedAt).toLocaleDateString()}`
            : ''}
        </p>
      ) : (
        <p className={cn('text-xs', siloBodyTextClass)}>
          Saved in Silo Builder and synced to Article Studio for editing.
        </p>
      )}

      <div
        className="prose prose-sm max-w-none rounded-lg border border-border bg-muted/30 p-4 text-foreground dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: node.content }}
      />
    </div>
  );
}

export default function NodeInspector({
  node,
  projectId,
  projectTitle,
  geography,
  open,
  onOpenChange,
  onNodeUpdated,
  onRetryGeneration,
}: NodeInspectorProps) {
  const { activeProjectId } = useProject();
  const [title, setTitle] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [metricsStale, setMetricsStale] = useState(false);

  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setTargetKeyword(node.targetKeyword ?? '');
      setMetricsStale(false);
    }
  }, [node]);

  if (!node) return null;

  async function handleRetryGeneration() {
    if (!node) return;

    setRetrying(true);
    try {
      if (onRetryGeneration) {
        await onRetryGeneration(node.id);
      } else {
        const res = await fetch('/api/silo-builder/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            nodeIds: [node.id],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Retry failed');
        toast.success(
          data.completed
            ? 'Article generated — scroll up to view it here.'
            : 'Generation restarted.'
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  }

  async function handleSave() {
    if (!node) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/silo-builder/nodes/${node.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          targetKeyword: targetKeyword.trim(),
          geography,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      onNodeUpdated(data.node);
      setMetricsStale(false);
      toast.success('Node updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleKeywordChange(value: string) {
    setTargetKeyword(value);
    if (value.trim() !== (node?.targetKeyword ?? '')) {
      setMetricsStale(true);
    }
  }

  const searchVolume = metricsStale ? null : node.searchVolume;
  const difficulty = metricsStale ? null : node.difficulty;

  if (node.type === 'PILLAR') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-left leading-snug">{node.title}</SheetTitle>
            <SheetDescription className={cn('text-left', siloKeywordClass)}>
              {node.targetKeyword ?? 'No target keyword'}
              {node.originalTargetKeyword ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Resolved from: {node.originalTargetKeyword}
                </span>
              ) : null}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('text-xs', siloPillarBadgeClass)}>
                PILLAR
              </Badge>
              <Badge variant="outline" className={cn('text-xs', siloStatusBadgeClass(node.status))}>
                {siloStatusLabel(node.status, node.wpPostStatus)}
              </Badge>
              <Badge variant="outline" className={cn('text-[11px]', siloMetaBadgeClass)}>
                Vol {formatMetric(searchVolume)}
              </Badge>
              <Badge variant="outline" className={cn('text-[11px]', siloMetaBadgeClass)}>
                KD {formatMetric(difficulty)}
              </Badge>
              {!metricsStale && node.enrichedAt ? (
                <Badge variant="outline" className={cn('text-[11px]', siloMetaBadgeClass)}>
                  {getMetricsFreshness(node.enrichedAt).label}
                </Badge>
              ) : null}
              <SiloMetricsConfidenceBadge confidence={node.metricsConfidence} />
            </div>

            {node.summary && (
              <div>
                <p className={cn('mb-1.5 text-[10px] font-semibold uppercase tracking-wide', siloSectionLabelClass)}>
                  Pillar Overview
                </p>
                <p className={cn('text-sm leading-relaxed', siloBodyTextClass)}>{node.summary}</p>
              </div>
            )}

            <GeneratedArticlePanel
              node={node}
              articleStudioProjectId={activeProjectId}
              onRetry={() => void handleRetryGeneration()}
              retrying={retrying}
            />

            {node.status === 'DRAFT' && (
              <DraftInArticleStudioButton
                node={node}
                projectId={projectId}
                projectTitle={projectTitle}
              />
            )}

            <div className="space-y-4 border-t border-border pt-4">
              <div className="space-y-2">
                <Label htmlFor="pillarTitle">Title</Label>
                <Input
                  id="pillarTitle"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pillarKeyword">Target Keyword</Label>
                <Input
                  id="pillarKeyword"
                  value={targetKeyword}
                  onChange={e => handleKeywordChange(e.target.value)}
                />
                {metricsStale && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Keyword changed — save to refresh search volume and difficulty.
                  </p>
                )}
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-indigo-600 dark:hover:bg-indigo-700"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-left leading-snug">{node.title}</SheetTitle>
          <SheetDescription className={cn('text-left', siloKeywordClass)}>
            {node.targetKeyword ?? 'No target keyword'}
            {node.originalTargetKeyword ? (
              <span className="mt-1 block text-xs text-muted-foreground">
                Resolved from: {node.originalTargetKeyword}
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {node.summary ? (
            <p className={cn('text-sm leading-relaxed', siloBodyTextClass)}>{node.summary}</p>
          ) : node.intent ? (
            <p className={cn('rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm leading-relaxed', siloBodyTextClass)}>
              {node.intent}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {node.funnelStage && (
              <Badge
                variant="outline"
                className={cn('text-[11px] font-semibold uppercase', siloFunnelStageClass(node.funnelStage))}
              >
                {node.funnelStage}
              </Badge>
            )}
            {node.intent && (
              <Badge variant="outline" className={cn('text-[11px]', siloNeutralBadgeClass)}>
                {node.intent}
              </Badge>
            )}
            <Badge variant="outline" className={cn('text-xs', siloStatusBadgeClass(node.status))}>
              {siloStatusLabel(node.status, node.wpPostStatus)}
            </Badge>
            <Badge variant="outline" className={cn('text-[11px]', siloMetaBadgeClass)}>
              Vol {formatMetric(searchVolume)}
            </Badge>
            <Badge variant="outline" className={cn('text-[11px]', siloMetaBadgeClass)}>
              KD {formatMetric(difficulty)}
            </Badge>
            {!metricsStale && node.enrichedAt ? (
              <Badge variant="outline" className={cn('text-[11px]', siloMetaBadgeClass)}>
                {getMetricsFreshness(node.enrichedAt).label}
              </Badge>
            ) : null}
            <SiloMetricsConfidenceBadge confidence={node.metricsConfidence} />
          </div>

          {node.anchorTextToPillar && (
            <div>
              <p className={cn('mb-1.5 text-[10px] font-semibold uppercase tracking-wide', siloSectionLabelClass)}>
                Anchor to Pillar
              </p>
              <span className="inline-block rounded-md border border-emerald-100 bg-emerald-50/60 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
                {node.anchorTextToPillar}
              </span>
            </div>
          )}

          {node.lateralLinks.length > 0 && (
            <div>
              <p className={cn('mb-1.5 text-[10px] font-semibold uppercase tracking-wide', siloSectionLabelClass)}>
                Lateral Links
              </p>
              <div className="space-y-1.5">
                {node.lateralLinks.map(link => (
                  <div
                    key={`${link.spokeTitle}-${link.suggestedLateralAnchorText}`}
                    className="rounded-md border border-emerald-100 bg-emerald-50/40 px-2 py-1.5 dark:border-violet-900/50 dark:bg-violet-950/30"
                  >
                    <p className="text-[11px] font-medium text-emerald-800 dark:text-violet-200">{link.spokeTitle}</p>
                    <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-violet-400">
                      {link.suggestedLateralAnchorText}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {node.semanticEntities.length > 0 && (
            <div>
              <p className={cn('mb-1.5 text-[10px] font-semibold uppercase tracking-wide', siloSectionLabelClass)}>
                Semantic Entities
              </p>
              <div className="flex flex-wrap gap-1.5">
                {node.semanticEntities.map(entity => (
                  <span
                    key={entity}
                    className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px]', siloNeutralBadgeClass)}
                  >
                    {entity}
                  </span>
                ))}
              </div>
            </div>
          )}

          <GeneratedArticlePanel
            node={node}
            articleStudioProjectId={activeProjectId}
            onRetry={() => void handleRetryGeneration()}
            retrying={retrying}
          />

          {node.status === 'DRAFT' && (
            <DraftInArticleStudioButton
              node={node}
              projectId={projectId}
              projectTitle={projectTitle}
            />
          )}

          <div className="space-y-4 border-t border-border pt-4">
            <div className="space-y-2">
              <Label htmlFor="spokeTitle">Title</Label>
              <Input
                id="spokeTitle"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="spokeKeyword">Target Keyword</Label>
              <Input
                id="spokeKeyword"
                value={targetKeyword}
                onChange={e => handleKeywordChange(e.target.value)}
              />
              {metricsStale && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Keyword changed — save to refresh search volume and difficulty.
                </p>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
