'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { useProject } from '@/components/projects/ProjectProvider';
import {
  formatGscBrandsInput,
  gscPropertyFromPrimaryUrl,
  type AeoBrandProfileRecord,
} from '@/lib/ai-visibility/aeo-brand-profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProgressTerminal from './ProgressTerminal';
import {
  appendStagingRows,
  getCeiling,
  setOnboardingIngesting,
  useOnboardingStore,
} from '@/lib/ai-visibility/onboarding/store';
import { remainingStagingSlots, CAPACITY_REACHED_MESSAGE } from '@/lib/ai-visibility/onboarding/capacity';
import {
  connectResilientSse,
  createThrottledBuffer,
} from '@/lib/ai-visibility/onboarding/sse-client';
import type { SseTerminalLine } from '@/lib/ai-visibility/onboarding/types';

type Props = {
  onBrandProfileUpdated?: () => void;
};

export default function TabGscImport({ onBrandProfileUpdated }: Props) {
  const { activeProjectId, activeProject } = useProject();
  const [brands, setBrands] = useState('');
  const [property, setProperty] = useState('');
  const [profile, setProfile] = useState<AeoBrandProfileRecord | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lines, setLines] = useState<SseTerminalLine[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const orderLen = useOnboardingStore(s => s.order.length);
  const accountLimit = useOnboardingStore(s => s.remainingAccountLimit);
  const settings = useOnboardingStore(s => s.workspaceSettings);
  const isIngesting = useOnboardingStore(s => s.isIngesting);
  const isBusy = useOnboardingStore(s => s.isIngesting || s.isCommitting);

  useEffect(() => {
    if (!activeProjectId?.trim()) {
      setProfile(null);
      setBrands('');
      setProperty('');
      return;
    }

    let cancelled = false;
    setProfileLoading(true);

    void (async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(activeProjectId)}/aeo-brand`
        );
        if (!res.ok) throw new Error('Failed to load brand profile');
        const data = (await res.json()) as { profile: AeoBrandProfileRecord | null };
        if (cancelled) return;
        const nextProfile = data.profile;
        setProfile(nextProfile);
        if (nextProfile) {
          setBrands(formatGscBrandsInput(nextProfile));
          setProperty(gscPropertyFromPrimaryUrl(nextProfile.primaryUrl));
        } else {
          setBrands('');
          setProperty(activeProject?.domain ? `sc-domain:${activeProject.domain.replace(/^www\./, '')}` : '');
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setBrands('');
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, activeProject?.domain]);

  function pushLine(level: SseTerminalLine['level'], message: string) {
    setLines(prev => [
      ...prev.slice(-80),
      {
        id: `${Date.now()}-${Math.random()}`,
        ts: new Date().toISOString(),
        level,
        message,
      },
    ]);
  }

  function connectOAuth() {
    setConnected(true);
    toast.success('Google Search Console connected (demo OAuth)');
  }

  function startImport() {
    if (!activeProjectId) {
      toast.error('Select a project before importing from GSC.');
      return;
    }
    if (!profile) {
      toast.error('Configure client brand profile before GSC import.');
      return;
    }
    if (!connected) {
      toast.error('Connect Google Search Console first');
      return;
    }
    if (!brands.trim()) {
      toast.error('Define at least one brand entity for query exclusion.');
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLines([]);
    setOnboardingIngesting(true);

    const remaining = remainingStagingSlots(orderLen, accountLimit);
    if (remaining <= 0) {
      toast.error(CAPACITY_REACHED_MESSAGE);
      setOnboardingIngesting(false);
      return;
    }

    const buffer = createThrottledBuffer<{ prompt: string; cluster: string }>(
      batch => {
        const result = appendStagingRows(
          batch.map(item => ({
            prompt: item.prompt,
            cluster: item.cluster,
            source: 'gsc',
          }))
        );
        if (result.capacityHit) {
          toast.error(CAPACITY_REACHED_MESSAGE);
          ac.abort();
        }
      },
      300
    );

    const defaultGeo = settings?.defaultGeo;
    const geoIsGlobal = Boolean(defaultGeo?.isGlobal);
    const qs = new URLSearchParams({
      brands,
      property,
      projectId: activeProjectId,
      remainingCapacity: String(remaining),
      geoIsGlobal: geoIsGlobal ? '1' : '0',
      countryCode: defaultGeo?.countryCode ?? 'US',
    });

    pushLine('info', `GSC → AEO translate (capacity ${remaining}/${getCeiling()})…`);

    const disconnect = connectResilientSse(
      `/api/ai-visibility/onboarding/gsc?${qs.toString()}`,
      {
        onEvent: (event, data) => {
          if (event === 'ping') {
            pushLine('ping', '[ping] heartbeat');
            return;
          }
          try {
            const parsed = JSON.parse(data) as {
              message?: string;
              items?: Array<{ prompt: string; cluster: string }>;
              capacityHalt?: boolean;
            };
            if (event === 'progress' && parsed.message) {
              pushLine('info', parsed.message);
            }
            if (event === 'prompts' && parsed.items?.length) {
              buffer.pushMany(parsed.items);
            }
            if (event === 'error' && parsed.message) {
              pushLine('error', parsed.message);
            }
            if (event === 'done') {
              buffer.flushNow();
              pushLine(
                'success',
                parsed.capacityHalt
                  ? 'Capacity reached — GSC import halted'
                  : 'GSC translation complete'
              );
              setOnboardingIngesting(false);
              onBrandProfileUpdated?.();
              disconnect();
            }
          } catch {
            /* */
          }
        },
        onError: () =>
          pushLine('warn', 'SSE interrupted — Last-Event-ID recovery…'),
      },
      ac.signal
    );

    ac.signal.addEventListener('abort', () => {
      buffer.clear();
      disconnect();
      setOnboardingIngesting(false);
    });
  }

  const missingProfile = Boolean(activeProjectId && !profileLoading && !profile);

  return (
    <div className="space-y-3">
      {!activeProjectId ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          Select a client project to import GSC queries with the correct brand entity.
        </p>
      ) : null}

      {missingProfile ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          Configure the client brand profile before GSC import. Brand tokens will be saved to
          profile aliases for citation matching.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Search Console</Label>
          <Button
            variant="outline"
            className="border-zinc-200 dark:border-zinc-800"
            onClick={connectOAuth}
            disabled={isBusy || !activeProjectId || missingProfile}
          >
            {connected ? 'GSC Connected' : 'Connect Google Search Console'}
          </Button>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label className="text-xs">Property</Label>
          <Input
            value={property}
            onChange={e => setProperty(e.target.value)}
            disabled={!connected || isBusy || profileLoading}
            placeholder="sc-domain:example.com"
            className="h-10 border-zinc-200 dark:border-zinc-800"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Define Brand Entity (comma-separated)</Label>
        <Input
          value={brands}
          onChange={e => setBrands(e.target.value)}
          placeholder="Brand name, brand.com, alternate alias"
          disabled={isBusy || profileLoading || !activeProjectId}
          className="h-10 border-zinc-200 dark:border-zinc-800"
        />
        <p className="text-[11px] text-muted-foreground">
          Pre-filled from client brand profile. Used to exclude navigational queries and merged
          into profile aliases on import.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-500"
          onClick={startImport}
          disabled={!connected || isBusy || !activeProjectId || missingProfile || profileLoading}
        >
          {isIngesting ? 'Translating…' : 'Import & Translate Queries'}
        </Button>
        {isIngesting ? (
          <Button
            variant="outline"
            className="border-zinc-200 dark:border-zinc-800"
            onClick={() => abortRef.current?.abort()}
          >
            Abort
          </Button>
        ) : null}
      </div>

      <ProgressTerminal lines={lines} />
      <p className="text-[11px] text-muted-foreground">
        Over-fetch top 1,000 by impressions → brand exclusion → capacity slice → micro-batches
        of 25 (concurrency 3) · brand tokens sync to AEO profile · end date = today − 3 days
      </p>
    </div>
  );
}
