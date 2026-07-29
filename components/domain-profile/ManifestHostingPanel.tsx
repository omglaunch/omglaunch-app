'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, Loader2, RefreshCw, Server, Webhook } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  getProductionManifestHealth,
  type ProductionManifestHealthResult,
} from '@/app/actions/domain-profile-manifest';
import SettingsSection from '@/components/settings/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  buildDemoManifestUrl,
  buildProductionManifestUrl,
  DOMAIN_PROFILE_WELL_KNOWN_PATH,
} from '@/lib/domain-profile/urls';
import type { ManifestWebhookDeliverySummary } from '@/lib/domain-profile/manifest-webhook-shared';
import { cn } from '@/lib/utils';

type ManifestHostingPanelProps = {
  projectId: string;
  projectDomain?: string | null;
  primaryUrl?: string | null;
  publishedManifest?: Record<string, unknown> | null;
  isPublished?: boolean;
  demoUrl?: string | null;
  demoBaseUrl?: string;
  publishedVersion?: number;
  webhookDelivery?: ManifestWebhookDeliverySummary | null;
  className?: string;
};

type ManifestHostingFooterProps = {
  projectId: string;
  website?: string | null;
  className?: string;
};

function useClientOrigin(fallback?: string): string {
  return useMemo(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      return window.location.origin;
    }
    return fallback?.replace(/\/+$/, '') ?? '';
  }, [fallback]);
}

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
    return true;
  } catch {
    toast.error('Unable to copy to clipboard.');
    return false;
  }
}

function ManifestUrlRow({
  label,
  badge,
  description,
  url,
  missingMessage,
  tone,
}: {
  label: string;
  badge: string;
  description: string;
  url: string | null;
  missingMessage?: string;
  tone: 'demo' | 'production';
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!url) return;
    const ok = await copyText(url, `${label} copied`);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        tone === 'demo'
          ? 'border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20'
          : 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {badge}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {tone === 'demo' ? (
          <Server className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
        ) : (
          <Globe className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
      </div>

      {url ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="block flex-1 truncate rounded-md border border-border bg-background px-2.5 py-2 font-mono text-xs text-foreground">
            {url}
          </code>
          <div className="flex shrink-0 gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy URL
                </>
              )}
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          {missingMessage ??
            'Set the client domain on the project or primary website on the brand profile to show the production URL.'}
        </p>
      )}
    </div>
  );
}

const HEALTH_LABELS: Record<
  ProductionManifestHealthResult['status'],
  { label: string; className: string }
> = {
  in_sync: {
    label: 'Live on client domain',
    className:
      'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300',
  },
  stale: {
    label: 'Stale on client domain',
    className: 'border-amber-200 text-amber-800 dark:border-amber-900 dark:text-amber-300',
  },
  not_found: {
    label: 'Not deployed',
    className: 'border-amber-200 text-amber-800 dark:border-amber-900 dark:text-amber-300',
  },
  unreachable: {
    label: 'Unreachable',
    className: 'border-red-200 text-red-700 dark:border-red-900 dark:text-red-300',
  },
  invalid: {
    label: 'Invalid response',
    className: 'border-red-200 text-red-700 dark:border-red-900 dark:text-red-300',
  },
  not_published: {
    label: 'Not published yet',
    className: 'border-muted text-muted-foreground',
  },
  no_url: {
    label: 'No production URL',
    className: 'border-muted text-muted-foreground',
  },
};

function ProductionHealthCard({
  projectId,
  productionUrl,
  isPublished,
  publishedVersion,
}: {
  projectId: string;
  productionUrl: string | null;
  isPublished: boolean;
  publishedVersion: number;
}) {
  const [health, setHealth] = useState<ProductionManifestHealthResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const runCheck = useCallback(async () => {
    if (!productionUrl) return;
    setIsChecking(true);
    try {
      const result = await getProductionManifestHealth(projectId);
      setHealth(result);
    } catch {
      toast.error('Production health check failed');
    } finally {
      setIsChecking(false);
    }
  }, [projectId, productionUrl]);

  useEffect(() => {
    if (productionUrl && isPublished) {
      void runCheck();
    } else {
      setHealth(null);
    }
  }, [productionUrl, isPublished, publishedVersion, runCheck]);

  if (!productionUrl) return null;

  const badge = health ? HEALTH_LABELS[health.status] : null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Production health check</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Probes the client-domain URL and compares it to your published omglaunch manifest.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isChecking || !isPublished}
          onClick={() => void runCheck()}
        >
          {isChecking ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Checking…
            </>
          ) : (
            <>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Check now
            </>
          )}
        </Button>
      </div>

      {!isPublished ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Publish a manifest first, then check whether the client domain serves the same JSON.
        </p>
      ) : isChecking && !health ? (
        <p className="mt-3 text-xs text-muted-foreground">Checking {productionUrl}…</p>
      ) : health ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {badge ? (
              <Badge variant="outline" className={badge.className}>
                {badge.label}
              </Badge>
            ) : null}
            {health.httpStatus ? (
              <span className="text-xs text-muted-foreground">HTTP {health.httpStatus}</span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              Checked {new Date(health.checkedAt).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{health.message}</p>
          {health.publishedName && health.liveName && health.status === 'stale' ? (
            <p className="text-xs text-muted-foreground">
              Published: <span className="font-medium text-foreground">{health.publishedName}</span>
              {' · '}
              Live: <span className="font-medium text-foreground">{health.liveName}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WebhookDeliveryCard({
  webhookDelivery,
}: {
  webhookDelivery: ManifestWebhookDeliverySummary | null | undefined;
}) {
  if (!webhookDelivery || webhookDelivery.skipped) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-foreground">Webhook deploy</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a webhook URL in Settings → Integrations to POST the published JSON to Zapier,
                Make, or your own deploy script on each publish.
              </p>
            </div>
            <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs" asChild>
              <Link href="/settings?tab=integrations">Configure webhooks →</Link>
            </Button>
            <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs" asChild>
              <Link href="/settings/webhook-guide">Deploy recipes →</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const allOk = webhookDelivery.failed === 0;
  const allFailed = webhookDelivery.succeeded === 0;
  const badgeClass = allOk
    ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300'
    : allFailed
      ? 'border-red-200 text-red-700 dark:border-red-900 dark:text-red-300'
      : 'border-amber-200 text-amber-800 dark:border-amber-900 dark:text-amber-300';
  const badgeLabel = allOk
    ? 'Delivered'
    : allFailed
      ? 'Delivery failed'
      : 'Partially delivered';

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Webhook deploy</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Last delivery after publish ({webhookDelivery.succeeded}/{webhookDelivery.attempted}{' '}
            OK).
          </p>
        </div>
        <Badge variant="outline" className={badgeClass}>
          {badgeLabel}
        </Badge>
      </div>

      {webhookDelivery.deliveredAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Sent {new Date(webhookDelivery.deliveredAt).toLocaleString()}
        </p>
      ) : null}

      {webhookDelivery.results.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {webhookDelivery.results.map(result => (
            <li
              key={result.url}
              className="rounded-md border border-border bg-background px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <code className="truncate font-mono text-[11px] text-foreground">{result.url}</code>
                <Badge
                  variant="outline"
                  className={
                    result.ok
                      ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300'
                      : 'border-red-200 text-red-700 dark:border-red-900 dark:text-red-300'
                  }
                >
                  {result.ok ? 'OK' : 'Failed'}
                </Badge>
                {result.statusCode ? (
                  <span className="text-muted-foreground">HTTP {result.statusCode}</span>
                ) : null}
              </div>
              {result.error ? (
                <p className="mt-1 text-muted-foreground">{result.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function ManifestHostingPanel({
  projectId,
  projectDomain,
  primaryUrl,
  publishedManifest,
  isPublished = false,
  demoUrl: demoUrlProp,
  demoBaseUrl,
  publishedVersion = 0,
  webhookDelivery = null,
  className,
}: ManifestHostingPanelProps) {
  const origin = useClientOrigin(demoBaseUrl);
  const demoUrl = demoUrlProp ?? buildDemoManifestUrl(projectId, origin);
  const productionUrl = buildProductionManifestUrl({ projectDomain, primaryUrl });
  const publishedJson = publishedManifest ? JSON.stringify(publishedManifest, null, 2) : null;

  async function handleCopyPublishedJson() {
    if (!publishedJson) return;
    await copyText(publishedJson, 'Published manifest JSON copied');
  }

  return (
    <SettingsSection
      title="Manifest hosting"
      description="Preview on omglaunch for internal QA, then deploy the published manifest to the client's domain for crawlers and AI systems."
      className={className}
    >
      <div className="space-y-3">
        <ManifestUrlRow
          label="Demo / preview endpoint"
          badge="omglaunch"
          description="Auth-gated preview on your workspace. Use for QA before client deploy — not what crawlers read in production."
          url={demoUrl}
          tone="demo"
        />
        <ManifestUrlRow
          label="Production endpoint"
          badge="client domain"
          description="Public URL on the client's website. Requires host matching or a static file upload after publish."
          url={productionUrl}
          missingMessage="Add a project domain (Settings → Client Brands) or brand primary URL to generate the production link."
          tone="production"
        />
      </div>

      <ProductionHealthCard
        projectId={projectId}
        productionUrl={productionUrl}
        isPublished={isPublished}
        publishedVersion={publishedVersion}
      />

      <WebhookDeliveryCard webhookDelivery={webhookDelivery} />

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <p className="text-sm font-medium text-foreground">Deploy to production</p>
        <ol className="mt-2 list-decimal space-y-2 pl-4 text-xs text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Publish</span> the draft manifest above so omglaunch
            stores the live JSON.
          </li>
          <li>
            <span className="font-medium text-foreground">Webhook (recommended):</span> add a URL in{' '}
            <Link href="/settings?tab=integrations" className="text-emerald-600 hover:underline dark:text-emerald-400">
              Settings → Integrations
            </Link>{' '}
            to POST the published JSON to Zapier, Make, or your deploy script on each publish.
          </li>
          <li>
            <span className="font-medium text-foreground">Host matching:</span> set{' '}
            <code className="rounded bg-muted px-1">Project.domain</code> to the client hostname and route{' '}
            <code className="rounded bg-muted px-1">{DOMAIN_PROFILE_WELL_KNOWN_PATH}</code> on that domain to
            omglaunch. Requests are matched by the <code className="rounded bg-muted px-1">Host</code> header.
          </li>
          <li>
            <span className="font-medium text-foreground">Static file:</span> copy the published JSON below and
            upload it to{' '}
            <code className="rounded bg-muted px-1">{DOMAIN_PROFILE_WELL_KNOWN_PATH}</code> on the client site.
            Re-upload after each publish.
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!publishedJson}
          onClick={() => void handleCopyPublishedJson()}
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copy published JSON
        </Button>
        {!isPublished ? (
          <span className="text-xs text-muted-foreground">
            Publish a manifest first to copy production-ready JSON.
          </span>
        ) : null}
        {!projectDomain?.trim() ? (
          <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs" asChild>
            <Link href="/settings?tab=aeo-brand">Set client domain →</Link>
          </Button>
        ) : null}
      </div>
    </SettingsSection>
  );
}

export function ManifestHostingFooter({ projectId, website, className }: ManifestHostingFooterProps) {
  const origin = useClientOrigin();
  const demoUrl = buildDemoManifestUrl(projectId, origin);
  const productionUrl = website
    ? `${website.replace(/\/+$/, '')}${DOMAIN_PROFILE_WELL_KNOWN_PATH}`
    : null;

  return (
    <div className={cn('shrink-0 border-t border-border bg-muted/30 px-4 py-2.5', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Manifest hosting</span>
        <ManifestFooterLink label="Demo" url={demoUrl} />
        {productionUrl ? (
          <ManifestFooterLink label="Production" url={productionUrl} />
        ) : (
          <span>Set client domain for production URL</span>
        )}
        <Link
          href="/settings?tab=domain-manifest"
          className="text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Settings → Domain Manifest
        </Link>
      </div>
    </div>
  );
}

function ManifestFooterLink({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(url, `${label} manifest URL copied`);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="uppercase tracking-wide">{label}:</span>
      <code className="max-w-[220px] truncate rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">
        {url.replace(/^https?:\/\//, '')}
      </code>
      <button
        type="button"
        className="inline-flex items-center text-emerald-600 hover:underline dark:text-emerald-400"
        onClick={() => void handleCopy()}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-emerald-600 hover:underline dark:text-emerald-400"
        aria-label={`Open ${label} manifest URL`}
      >
        <ExternalLink className="h-3 w-3" />
      </a>
    </span>
  );
}
