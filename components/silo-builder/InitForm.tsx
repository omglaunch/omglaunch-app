'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Crosshair,
  Globe,
  Layers,
  Loader2,
  Network,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  COMPETITOR_INTEL_COUNTRIES,
  DEFAULT_COMPETITOR_INTEL_COUNTRY,
  type ReverseEngineerProgressStep,
} from '@/lib/competitor-intel/constants';
import {
  SILO_COMPETITOR_ATTACK_CREDIT_COST,
  SILO_KEYWORD_MAP_CREDIT_COST,
  ZERO_COMPETITOR_KEYWORDS_ERROR,
} from '@/lib/silo-builder/constants';
import type { SiloInitPrefill } from '@/lib/silo-builder/deep-link';
import type { SiloProjectDto, WordPressSiteOption } from '@/lib/silo-builder/types';
import ZeroCompetitorKeywordsAlert from '@/components/silo-builder/ZeroCompetitorKeywordsAlert';
import CompetitorPipelineProgress from '@/components/silo-builder/CompetitorPipelineProgress';
import SiloModeComparisonHelp from '@/components/silo-builder/SiloModeComparisonHelp';
import MigrationGuidePanel from '@/components/silo-builder/MigrationGuidePanel';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

type InitFormProps = {
  onProjectCreated: (project: SiloProjectDto) => void;
  initialPrefill?: SiloInitPrefill | null;
};

type FormComplexity = 'quick' | 'advanced';

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 120;

type CompetitorAttackPollResponse = {
  taskId: string;
  state: string;
  step?: ReverseEngineerProgressStep;
  error?: string;
  errorCode?: string;
  project?: SiloProjectDto;
  domain?: string;
  keywordsAnalyzed?: number;
  completed?: boolean;
};

function resolveCompetitorAttackHttpError(
  response: Response,
  payload: CompetitorAttackPollResponse | Record<string, unknown>
): string {
  const apiError =
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string' &&
    payload.error.trim()
      ? payload.error.trim()
      : null;

  if (apiError) {
    if (apiError.includes('rankedKeywords') || apiError.includes('P2022')) {
      return 'Database schema is out of date. Run `npx prisma db push`, restart the dev server, then try again.';
    }
    return apiError;
  }

  if (response.status === 502 || response.status === 503) {
    return 'Server is unavailable. Restart `npm run dev` and try again.';
  }

  if (response.status === 401) {
    return 'Session expired. Refresh the page and sign in again.';
  }

  return `Attack map failed (HTTP ${response.status}).`;
}

type FieldGroupProps = {
  id: string;
  label: string;
  hint: string;
  children: React.ReactNode;
};

function FieldGroup({ id, label, hint, children }: FieldGroupProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

const inputClassName =
  'border-border bg-background text-foreground placeholder:text-muted-foreground';

const selectTriggerClassName = 'border-border bg-background text-foreground';

function FormModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: FormComplexity;
  onChange: (value: FormComplexity) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={next => {
        if (next === 'quick' || next === 'advanced') {
          onChange(next);
        }
      }}
      variant="outline"
      size="sm"
      disabled={disabled}
      className="rounded-lg border border-border bg-muted/40 p-1"
    >
      <ToggleGroupItem value="quick" className="gap-1.5 px-3 text-xs sm:text-sm">
        Quick Start
      </ToggleGroupItem>
      <ToggleGroupItem value="advanced" className="gap-1.5 px-3 text-xs sm:text-sm">
        Advanced
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export default function InitForm({ onProjectCreated, initialPrefill }: InitFormProps) {
  const [sites, setSites] = useState<WordPressSiteOption[]>([]);
  const [integrationId, setIntegrationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'keyword' | 'competitor'>(
    initialPrefill?.activeTab ?? 'keyword'
  );
  const [keywordFormMode, setKeywordFormMode] = useState<FormComplexity>('quick');
  const [competitorFormMode, setCompetitorFormMode] = useState<FormComplexity>('quick');

  const [seedKeyword, setSeedKeyword] = useState(initialPrefill?.seedKeyword ?? '');
  const [niche, setNiche] = useState('');
  const [geographyKeyword, setGeographyKeyword] = useState(
    initialPrefill?.geography ?? 'Malaysia'
  );

  const [competitorDomain, setCompetitorDomain] = useState('');
  const [geographyCompetitor, setGeographyCompetitor] = useState<string>(
    initialPrefill?.geography ?? DEFAULT_COMPETITOR_INTEL_COUNTRY
  );
  const [competitorError, setCompetitorError] = useState<string | null>(null);
  const [zeroResults, setZeroResults] = useState(false);
  const [isCompetitorRunning, setIsCompetitorRunning] = useState(false);
  const [competitorProgressStep, setCompetitorProgressStep] =
    useState<ReverseEngineerProgressStep>('queued');
  const [competitorKeywordsAnalyzed, setCompetitorKeywordsAnalyzed] = useState<number | null>(
    null
  );
  const pollAbortRef = useRef(false);

  function clearCompetitorFeedback() {
    setCompetitorError(null);
    setZeroResults(false);
  }

  function handleCompetitorDomainChange(value: string) {
    setCompetitorDomain(value);
    clearCompetitorFeedback();
  }

  function handleCompetitorGeographyChange(value: string) {
    setGeographyCompetitor(value);
    clearCompetitorFeedback();
  }

  useEffect(() => {
    if (!initialPrefill) {
      return;
    }

    if (initialPrefill.seedKeyword) {
      setSeedKeyword(initialPrefill.seedKeyword);
    }

    if (initialPrefill.geography) {
      setGeographyKeyword(initialPrefill.geography);
      setGeographyCompetitor(initialPrefill.geography);
    }

    if (initialPrefill.activeTab) {
      setActiveTab(initialPrefill.activeTab);
    }

    if (initialPrefill.mode === 'quick') {
      setKeywordFormMode('quick');
    }
  }, [initialPrefill]);

  const pollCompetitorTaskUntilComplete = useCallback(
    async (taskId: string): Promise<CompetitorAttackPollResponse> => {
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        if (pollAbortRef.current) {
          throw new Error('Polling cancelled.');
        }

        const response = await fetch(
          `/api/silo-builder/competitor-attack?taskId=${encodeURIComponent(taskId)}`
        );
        const payload = (await response.json().catch(() => ({}))) as CompetitorAttackPollResponse;

        if (!response.ok) {
          throw new Error(resolveCompetitorAttackHttpError(response, payload));
        }

        if (payload.step) {
          setCompetitorProgressStep(payload.step);
        }

        if (payload.keywordsAnalyzed != null) {
          setCompetitorKeywordsAnalyzed(payload.keywordsAnalyzed);
        }

        if (payload.state === 'FAILED') {
          if (payload.errorCode === ZERO_COMPETITOR_KEYWORDS_ERROR) {
            setZeroResults(true);
            const zeroError = new Error(
              payload.error ?? 'No ranked keywords found for this domain.'
            );
            zeroError.name = ZERO_COMPETITOR_KEYWORDS_ERROR;
            throw zeroError;
          }
          throw new Error(
            payload.error ??
              'Competitor attack task failed. Check the dev server terminal for details.'
          );
        }

        if (payload.state === 'COMPLETED' && payload.project) {
          return payload;
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      throw new Error('Task timed out while waiting for completion.');
    },
    []
  );

  useEffect(() => {
    return () => {
      pollAbortRef.current = true;
    };
  }, []);

  const keywordNicheRequired = keywordFormMode === 'advanced';
  const competitorNicheRequired = competitorFormMode === 'advanced';

  useEffect(() => {
    fetch('/api/silo-builder/integrations')
      .then(res => res.json())
      .then(data => {
        const list = (data.sites ?? []) as WordPressSiteOption[];
        setSites(list);
        if (list[0]) setIntegrationId(list[0].integrationId);
      })
      .catch(() => undefined);
  }, []);

  async function runKeywordMap() {
    if (!seedKeyword.trim()) {
      toast.error('Enter a seed keyword to architect your silo.');
      return;
    }

    if (keywordNicheRequired && !niche.trim()) {
      toast.error('Enter a niche / target audience, or switch to Quick Start.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/silo-builder/keyword-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedKeyword,
          niche: keywordNicheRequired ? niche : undefined,
          geography: geographyKeyword,
          integrationId: integrationId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      window.dispatchEvent(new Event('credits-updated'));
      onProjectCreated(data.project);
      toast.success(
        data.metricsEnriching
          ? 'Keyword silo map ready — enriching volume/KD in the background…'
          : 'Keyword silo map generated'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  async function runCompetitorAttack() {
    if (!competitorDomain.trim()) {
      toast.error('Enter a competitor domain to reverse-engineer.');
      return;
    }

    if (competitorNicheRequired && !niche.trim()) {
      toast.error('Enter a niche / target audience, or switch to Quick Start.');
      return;
    }

    clearCompetitorFeedback();
    setIsCompetitorRunning(true);
    setCompetitorProgressStep('queued');
    setCompetitorKeywordsAnalyzed(null);
    pollAbortRef.current = false;

    try {
      const res = await fetch('/api/silo-builder/competitor-attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: competitorDomain,
          niche: competitorNicheRequired ? niche : undefined,
          geography: geographyCompetitor,
          integrationId: integrationId || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as CompetitorAttackPollResponse;

      if (res.status === 402) {
        const message =
          typeof data.error === 'string' ? data.error : 'Insufficient credits.';
        setCompetitorError(message);
        toast.error(message);
        return;
      }

      if (
        res.status === 422 ||
        data.errorCode === ZERO_COMPETITOR_KEYWORDS_ERROR
      ) {
        const message =
          typeof data.error === 'string'
            ? data.error
            : 'No ranked keywords found for this domain.';
        setZeroResults(true);
        setCompetitorError(message);
        return;
      }

      if (!res.ok) {
        throw new Error(resolveCompetitorAttackHttpError(res, data));
      }

      let result = data;

      if (!data.completed && data.taskId) {
        result = await pollCompetitorTaskUntilComplete(data.taskId);
      }

      if (!result.project) {
        throw new Error('Completed task returned no project data.');
      }

      window.dispatchEvent(new Event('credits-updated'));
      setCompetitorProgressStep('complete');
      onProjectCreated(result.project);
      toast.success('Competitor attack map generated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Attack map failed';
      setCompetitorError(message);
      if (
        !(error instanceof Error && error.name === ZERO_COMPETITOR_KEYWORDS_ERROR)
      ) {
        toast.error(message);
      }
    } finally {
      setIsCompetitorRunning(false);
      window.dispatchEvent(new Event('credits-updated'));
    }
  }

  const siteSelector = (
    <FieldGroup
      id="wordpressSite"
      label="Target WordPress Site"
      hint="Optional — connect a site in Settings → Integrations so generated content can publish directly to WordPress via the Content Factory."
    >
      <Select value={integrationId || 'none'} onValueChange={setIntegrationId} disabled={loading}>
        <SelectTrigger id="wordpressSite" className={selectTriggerClassName}>
          <SelectValue placeholder="Select WordPress site" />
        </SelectTrigger>
        <SelectContent className="border-border bg-popover text-popover-foreground">
          {sites.length === 0 ? (
            <SelectItem value="none" disabled>
              No WordPress site connected
            </SelectItem>
          ) : (
            sites.map(site => (
              <SelectItem key={site.integrationId} value={site.integrationId}>
                {site.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </FieldGroup>
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <MigrationGuidePanel
        onSelectTab={tab => {
          setActiveTab(tab);
          if (tab === 'keyword') {
            setKeywordFormMode('quick');
          } else {
            setCompetitorFormMode('quick');
          }
        }}
      />

      <section className="overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="space-y-2 lg:space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
              <Layers className="h-3.5 w-3.5" />
              Silo Builder
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
              Architect Your Content Silo
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Unify Hub &amp; Spoke keyword mapping and competitor gap analysis into one semantic
              architecture engine. Build from a seed keyword or reverse-engineer a rival&apos;s
              organic footprint to expose attack vectors.
            </p>
          </div>
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100 dark:bg-indigo-950 dark:ring-indigo-800 sm:flex">
            <Network className="h-6 w-6 text-emerald-600 dark:text-indigo-300" />
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={value => {
            if (value === 'keyword' || value === 'competitor') {
              setActiveTab(value);
            }
          }}
          className="mt-6 w-full lg:mt-8"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1 sm:flex-1">
              <TabsTrigger
                value="keyword"
                className={cn(
                  'gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                  'text-muted-foreground'
                )}
              >
                <Network className="h-4 w-4" />
                Build from Keyword
              </TabsTrigger>
              <TabsTrigger
                value="competitor"
                className={cn(
                  'gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                  'text-muted-foreground'
                )}
              >
                <Crosshair className="h-4 w-4" />
                Reverse-Engineer Competitor
              </TabsTrigger>
            </TabsList>
            <SiloModeComparisonHelp />
          </div>

          <TabsContent value="keyword" className="mt-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-medium text-foreground">Seed Configuration</h2>
                <p className="text-sm text-muted-foreground">
                  {keywordFormMode === 'quick'
                    ? `Enter a seed keyword and geography — same 2-field flow as Hub & Spoke. Costs ${SILO_KEYWORD_MAP_CREDIT_COST} credits per run.`
                    : `Add a niche to tailor titles, intent, and semantic relationships. Costs ${SILO_KEYWORD_MAP_CREDIT_COST} credits per run.`}
                </p>
              </div>
              <FormModeToggle
                value={keywordFormMode}
                onChange={setKeywordFormMode}
                disabled={loading}
              />
            </div>

            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={event => {
                event.preventDefault();
                void runKeywordMap();
              }}
            >
              {siteSelector}

              <FieldGroup
                id="seedKeyword"
                label="Seed Keyword"
                hint="The head term or topic you want to own — e.g. a product category, service, or informational theme."
              >
                <Input
                  id="seedKeyword"
                  placeholder="e.g. solar panel installation"
                  value={seedKeyword}
                  onChange={e => setSeedKeyword(e.target.value)}
                  disabled={loading}
                  className={inputClassName}
                />
              </FieldGroup>

              {keywordNicheRequired ? (
                <FieldGroup
                  id="niche"
                  label="Niche / Target Audience"
                  hint="Who this silo is for and what angle to emphasize — helps the AI tailor titles, intent, and semantic relationships."
                >
                  <Input
                    id="niche"
                    placeholder="e.g. B2B SaaS founders in Southeast Asia"
                    value={niche}
                    onChange={e => setNiche(e.target.value)}
                    disabled={loading}
                    className={inputClassName}
                  />
                </FieldGroup>
              ) : null}

              <FieldGroup
                id="geographyKeyword"
                label="Target Geography"
                hint="Region used for search volume and keyword difficulty metrics via DataForSEO."
              >
                <Select
                  value={geographyKeyword}
                  onValueChange={setGeographyKeyword}
                  disabled={loading}
                >
                  <SelectTrigger id="geographyKeyword" className={selectTriggerClassName}>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover text-popover-foreground">
                    {COMPETITOR_INTEL_COUNTRIES.map(c => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldGroup>

              <div className="flex items-end md:col-span-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 sm:w-auto sm:min-w-[220px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Architecting Silo…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Keyword Silo
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="competitor" className="mt-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-medium text-foreground">Competitor Recon</h2>
                <p className="text-sm text-muted-foreground">
                  {competitorFormMode === 'quick'
                    ? `Enter a competitor domain and geography to reverse-engineer their footprint. Costs ${SILO_COMPETITOR_ATTACK_CREDIT_COST} credits per run.`
                    : `Add your niche to anchor gap analysis relative to your positioning. Costs ${SILO_COMPETITOR_ATTACK_CREDIT_COST} credits per run.`}
                </p>
              </div>
              <FormModeToggle
                value={competitorFormMode}
                onChange={setCompetitorFormMode}
                disabled={loading || isCompetitorRunning}
              />
            </div>

            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={event => {
                event.preventDefault();
                void runCompetitorAttack();
              }}
            >
              {siteSelector}

              <FieldGroup
                id="competitorDomain"
                label="Competitor Domain"
                hint="The rival site to deconstruct — enter the root domain without https:// (e.g. competitor.com)."
              >
                <Input
                  id="competitorDomain"
                  placeholder="competitor.com"
                  value={competitorDomain}
                  onChange={e => handleCompetitorDomainChange(e.target.value)}
                  disabled={loading || isCompetitorRunning}
                  className={cn(inputClassName, 'focus-visible:ring-emerald-500')}
                />
              </FieldGroup>

              {competitorNicheRequired ? (
                <FieldGroup
                  id="nicheCompetitor"
                  label="Niche / Target Audience"
                  hint="Your core niche — anchors the attack strategy so gaps are identified relative to what you want to rank for."
                >
                  <Input
                    id="nicheCompetitor"
                    placeholder="e.g. B2B SaaS marketing"
                    value={niche}
                    onChange={e => setNiche(e.target.value)}
                    disabled={loading || isCompetitorRunning}
                    className={cn(inputClassName, 'focus-visible:ring-emerald-500')}
                  />
                </FieldGroup>
              ) : null}

              <FieldGroup
                id="geographyCompetitor"
                label="Target Geography"
                hint="Country for DataForSEO ranked keyword telemetry — must match where you want to compete."
              >
                <Select
                  value={geographyCompetitor}
                  onValueChange={handleCompetitorGeographyChange}
                  disabled={loading || isCompetitorRunning}
                >
                  <SelectTrigger
                    id="geographyCompetitor"
                    className={cn(selectTriggerClassName, 'focus:ring-emerald-500')}
                  >
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover text-popover-foreground">
                    {COMPETITOR_INTEL_COUNTRIES.map(c => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldGroup>

              <div className="flex items-end md:col-span-2">
                <Button
                  type="submit"
                  disabled={loading || isCompetitorRunning}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 sm:w-auto sm:min-w-[220px]"
                >
                  {isCompetitorRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running Pipeline…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Attack Map
                    </>
                  )}
                </Button>
              </div>
            </form>

            {isCompetitorRunning ? (
              <CompetitorPipelineProgress
                step={competitorProgressStep}
                keywordsAnalyzed={competitorKeywordsAnalyzed}
              />
            ) : null}

            {competitorError && !isCompetitorRunning ? (
              zeroResults ? (
                <ZeroCompetitorKeywordsAlert message={competitorError} />
              ) : (
                <div
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200"
                  role="alert"
                >
                  {competitorError}
                </div>
              )
            ) : null}
          </TabsContent>
        </Tabs>

        {sites.length === 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            <Globe className="mr-1 inline h-3.5 w-3.5" />
            No WordPress site connected.{' '}
            <Link href="/settings" className="text-emerald-600 hover:underline dark:text-indigo-400">
              Connect in Settings → Integrations
            </Link>{' '}
            to enable direct publishing.
          </p>
        )}
      </section>
    </div>
  );
}
