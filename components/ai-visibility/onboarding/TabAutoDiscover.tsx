'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useProject } from '@/components/projects/ProjectProvider';
import { defaultDiscoverUrlFromProject } from '@/lib/ai-visibility/aeo-brand-profile';
import type { AeoBrandProfileRecord } from '@/lib/ai-visibility/aeo-brand-profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProgressTerminal from './ProgressTerminal';
import {
  appendStagingRows,
  getCeiling,
  setOnboardingIngesting,
  useOnboardingStore,
} from '@/lib/ai-visibility/onboarding/store';
import {
  remainingStagingSlots,
  CAPACITY_REACHED_MESSAGE,
} from '@/lib/ai-visibility/onboarding/capacity';
import {
  connectResilientSse,
  createThrottledBuffer,
} from '@/lib/ai-visibility/onboarding/sse-client';
import type { SseTerminalLine } from '@/lib/ai-visibility/onboarding/types';

type Props = {
  onBrandProfileUpdated?: () => void;
};

export default function TabAutoDiscover({ onBrandProfileUpdated }: Props) {
  const { activeProjectId, activeProject } = useProject();
  const [url, setUrl] = useState('');
  const [profile, setProfile] = useState<AeoBrandProfileRecord | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [lines, setLines] = useState<SseTerminalLine[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const orderLen = useOnboardingStore(s => s.order.length);
  const accountLimit = useOnboardingStore(s => s.remainingAccountLimit);
  const isIngesting = useOnboardingStore(s => s.isIngesting);
  const isBusy = useOnboardingStore(s => s.isIngesting || s.isCommitting);

  useEffect(() => {
    if (!activeProjectId?.trim()) {
      setProfile(null);
      setUrl('');
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
        setProfile(data.profile);
        setUrl(
          defaultDiscoverUrlFromProject(data.profile, activeProject?.domain ?? null)
        );
      } catch {
        if (!cancelled) {
          setProfile(null);
          setUrl(defaultDiscoverUrlFromProject(null, activeProject?.domain ?? null));
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

  function startDiscover() {
    if (!activeProjectId) {
      toast.error('Select a project before running auto-discover.');
      return;
    }
    if (!profile) {
      toast.error('Configure client brand profile before auto-discover.');
      return;
    }
    if (!url.trim()) {
      toast.error('Enter a domain URL');
      return;
    }

    const remaining = remainingStagingSlots(orderLen, accountLimit);
    if (remaining <= 0) {
      toast.error(CAPACITY_REACHED_MESSAGE);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLines([]);
    setOnboardingIngesting(true);

    const buffer = createThrottledBuffer<{ prompt: string; cluster: string }>(
      batch => {
        const result = appendStagingRows(
          batch.map(item => ({
            prompt: item.prompt,
            cluster: item.cluster,
            source: 'crawler',
          }))
        );
        if (result.capacityHit) {
          toast.error(CAPACITY_REACHED_MESSAGE);
          ac.abort();
        }
      },
      300
    );

    pushLine('info', `Discovering prompts (capacity ${remaining}/${getCeiling()})…`);

    const qs = new URLSearchParams({
      url: url.trim(),
      projectId: activeProjectId,
      remainingCapacity: String(remaining),
    });

    const disconnect = connectResilientSse(
      `/api/ai-visibility/onboarding/discover?${qs.toString()}`,
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
              prompts?: Array<{ prompt: string; cluster: string }>;
              capacityHalt?: boolean;
            };
            if (event === 'progress' && parsed.message) {
              pushLine('info', parsed.message);
            }
            if (event === 'prompts' && parsed.items) {
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
                  ? 'Capacity limit reached — discovery halted'
                  : 'Discovery complete'
              );
              setOnboardingIngesting(false);
              onBrandProfileUpdated?.();
              disconnect();
            }
          } catch {
            /* ignore */
          }
        },
        onError: () => {
          pushLine('warn', 'SSE interrupted — attempting Last-Event-ID recovery…');
        },
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
          Select a client project to crawl the correct website.
        </p>
      ) : null}

      {missingProfile ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          Configure the client brand profile first. The crawl URL will be saved as the
          profile primary website.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://clientsite.com"
            className="h-10 border-zinc-200 bg-slate-50 pl-9 dark:border-zinc-800 dark:bg-zinc-900"
            disabled={isBusy || profileLoading || !activeProjectId}
          />
        </div>
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-500"
          onClick={startDiscover}
          disabled={isBusy || profileLoading || !activeProjectId || missingProfile}
        >
          {isIngesting ? 'Discovering…' : 'Discover Prompts'}
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
        Pre-filled from client brand URL · crawl syncs primaryUrl on discover ·
        same-origin · sitemap-first · max 10 pages · capacity-aware halt
      </p>
    </div>
  );
}
