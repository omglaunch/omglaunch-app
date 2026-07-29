import Link from 'next/link';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Heading,
  ImageIcon,
  Lightbulb,
  ListChecks,
  Sparkles,
  Type,
} from 'lucide-react';
import AppMain from '@/components/layout/AppMain';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { parseAuditData, scoreBadgeClass, scoreColorClass } from '@/lib/audit-data';
import { prisma } from '@/lib/prisma';
import { cn } from '@/lib/utils';
import PageAuditJsonLdBadge from '@/components/page-audit/PageAuditJsonLdBadge';
import PageAuditReadabilityCard from '@/components/page-audit/PageAuditReadabilityCard';
import TopSemanticEntityGaps from '@/components/page-audit/TopSemanticEntityGaps';

const DownloadPdfButton = dynamic(() => import('./DownloadPdfButton'), {
  ssr: false,
});

const SharePageAuditButton = dynamic(() => import('./SharePageAuditButton'), {
  ssr: false,
});

type PageProps = {
  params: { id: string };
};

function ScoreRing({ score }: { score: number }) {
  const colors = scoreColorClass(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (Math.min(Math.max(score, 0), 100) / 100) * circumference;

  return (
    <div className={cn('relative flex h-44 w-44 items-center justify-center rounded-full', colors.bg)}>
      <svg className="absolute h-40 w-40 -rotate-90" viewBox="0 0 120 120" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="8"
          className="stroke-white/80"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={colors.ring}
          strokeDasharray={`${progress} ${circumference}`}
        />
      </svg>
      <div className="relative text-center">
        <p className={cn('text-5xl font-bold tabular-nums tracking-tight', colors.text)}>
          {score.toFixed(0)}
        </p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          GEO Score
        </p>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <AppMain>
      <div className="flex min-h-full flex-col items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Audit not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This report may have been removed or the link is invalid.
          </p>
          <Link
            href="/page-audit"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-blue-600 dark:hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Page Audit
          </Link>
        </div>
      </div>
    </AppMain>
  );
}

export default async function PageAuditDetailPage({ params }: PageProps) {
  const id = parseInt(params.id, 10);

  if (Number.isNaN(id)) {
    return <NotFoundState />;
  }

  const audit = await prisma.pageAudit.findUnique({
    where: { id },
  });

  if (!audit) {
    return <NotFoundState />;
  }

  const data = parseAuditData(audit.auditData);
  const images = data.images ?? { total: 0, missingAlt: 0 };
  const altCoverage =
    images.total > 0
      ? Math.round(((images.total - images.missingAlt) / images.total) * 100)
      : null;

  return (
    <AppMain>
      <div className="min-h-full p-8">
          <Link
            href="/page-audit"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to audits
          </Link>

          {/* Hero */}
          <div className="mb-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-border dark:bg-card">
            <div className="bg-white px-6 py-6 dark:bg-gradient-to-br dark:from-blue-600 dark:via-blue-700 dark:to-indigo-800 dark:px-8 dark:py-10 dark:text-white">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-emerald-200/60 bg-emerald-50 font-medium text-emerald-700 dark:border-white/30 dark:bg-card/10 dark:text-white dark:backdrop-blur-sm"
                    >
                      Page Audit Report
                    </Badge>
                    <PageAuditJsonLdBadge url={audit.url} keyword={audit.targetKeyword} />
                    <span className="text-sm text-zinc-500 dark:text-blue-100">
                      {format(new Date(audit.createdAt), 'MMMM d, yyyy · h:mm a')}
                    </span>
                  </div>
                  <h1 className="text-2xl font-semibold leading-tight text-zinc-900 sm:text-3xl dark:text-white">
                    {audit.targetKeyword}
                  </h1>
                  <a
                    href={audit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-blue-100 dark:hover:text-white"
                  >
                    <span className="truncate">{audit.url}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-4 sm:flex-row lg:flex-col lg:items-end">
                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    <DownloadPdfButton
                      auditId={audit.id}
                      url={audit.url}
                      targetKeyword={audit.targetKeyword}
                      geoScore={audit.geoScore}
                      createdAt={audit.createdAt.toISOString()}
                      data={data}
                    />
                    <SharePageAuditButton auditId={audit.id} />
                  </div>
                  <div className="rounded-full bg-card p-3 shadow-lg">
                    <ScoreRing score={audit.geoScore} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid divide-y border-t border-zinc-200 dark:border-border sm:grid-cols-2 lg:grid-cols-4 sm:divide-x sm:divide-y-0">
              <div className="px-6 py-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Word Count
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {data.wordCount?.toLocaleString() ?? '—'}
                </p>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Headings Found
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {data.headings?.length ?? 0}
                </p>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Images
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {images.total}
                  {images.total > 0 && (
                    <span className="ml-2 text-base font-normal text-muted-foreground">
                      ({images.missingAlt} missing alt)
                    </span>
                  )}
                </p>
              </div>
              <PageAuditReadabilityCard url={audit.url} keyword={audit.targetKeyword} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            {/* AI Analysis */}
            <Card className="border-border shadow-sm lg:col-span-3">
              <CardHeader className="border-b border-border bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-violet-50 dark:to-indigo-50/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 shadow-sm dark:bg-violet-600">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">AI Deep-Dive Analysis</CardTitle>
                    <CardDescription>
                      Gemini-powered GEO insights for this page and keyword
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {data.analysis ? (
                  <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                    {data.analysis}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No analysis available.</p>
                )}
              </CardContent>
            </Card>

            {/* Quick stats sidebar */}
            <Card className="border-border shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Score Summary</CardTitle>
                <CardDescription>Overall AI-readiness rating</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/80 px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">GEO Score</span>
                  <Badge
                    variant="outline"
                    className={cn('font-semibold tabular-nums', scoreBadgeClass(audit.geoScore))}
                  >
                    {audit.geoScore.toFixed(0)} / 100
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/80 px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">Target Keyword</span>
                  <span className="text-sm font-semibold text-foreground">{audit.targetKeyword}</span>
                </div>
                {altCoverage !== null && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/80 px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">Alt Text Coverage</span>
                    <span className="text-sm font-semibold text-foreground">{altCoverage}%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {data.actionPlan && data.actionPlan.length > 0 && (
            <div className="mt-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 shadow-sm">
                  <ListChecks className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Action Plan</h2>
                  <p className="text-sm text-muted-foreground">
                    Copy-paste fixes to improve your GEO score
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {data.actionPlan.map((item, index) => (
                  <Card
                    key={`${index}-${item.title}`}
                    className="border-border shadow-sm transition-shadow hover:shadow-md"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
                          <CardDescription className="mt-1.5 leading-relaxed">
                            {item.reasoning}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                        <div className="flex-1 rounded-lg border border-red-100 bg-red-50/80 p-3">
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-500">
                            Before
                          </p>
                          <p className="text-sm leading-relaxed text-red-900/80">
                            {item.currentText}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center justify-center px-1 py-1 sm:flex-col sm:py-0">
                          <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground sm:rotate-0" />
                        </div>
                        <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                            After
                          </p>
                          <p className="text-sm font-medium leading-relaxed text-emerald-900">
                            {item.suggestedText}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <TopSemanticEntityGaps url={audit.url} keyword={audit.targetKeyword} />

          {data.bonusTip && (
            <div className="mt-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 shadow-sm dark:bg-violet-600">
                  <Lightbulb className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Strategic Edge</h2>
                  <p className="text-sm text-muted-foreground">
                    Long-term positioning beyond immediate fixes
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-amber-50 via-violet-50 to-purple-50 shadow-sm">
                <div className="border-b border-violet-100/80 bg-violet-600/5 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 shadow-sm">
                      <Sparkles className="h-4 w-4 text-white" />
                    </span>
                    <span className="text-sm font-semibold uppercase tracking-wider text-violet-700">
                      Pro Tip
                    </span>
                  </div>
                </div>
                <div className="px-6 py-5">
                  <p className="text-base leading-relaxed text-foreground">{data.bonusTip}</p>
                </div>
              </div>
            </div>
          )}

          {/* Structural breakdown */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card className="border-border shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-blue-100">
                    <Type className="h-4 w-4 text-emerald-700 dark:text-blue-700" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Page Title</CardTitle>
                    <CardDescription>Exact title tag crawled from the page</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {data.title ? (
                  <p className="rounded-lg border border-border bg-muted/80 px-4 py-3 text-sm leading-relaxed text-foreground">
                    {data.title}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No title found.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                    <ImageIcon className="h-4 w-4 text-emerald-700" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Image Alt Text Stats</CardTitle>
                    <CardDescription>Accessibility signals from crawled images</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-muted/80 px-4 py-3 text-center">
                    <p className="text-2xl font-semibold tabular-nums text-foreground">
                      {images.total}
                    </p>
                    <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Total
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/80 px-4 py-3 text-center">
                    <p className="text-2xl font-semibold tabular-nums text-emerald-600">
                      {images.total - images.missingAlt}
                    </p>
                    <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      With Alt
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/80 px-4 py-3 text-center">
                    <p
                      className={cn(
                        'text-2xl font-semibold tabular-nums',
                        images.missingAlt > 0 ? 'text-red-600' : 'text-foreground'
                      )}
                    >
                      {images.missingAlt}
                    </p>
                    <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Missing
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                    <Heading className="h-4 w-4 text-amber-700" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">H1 &amp; H2 Headings</CardTitle>
                    <CardDescription>
                      Full list of heading elements parsed from the page ({data.headings?.length ?? 0}{' '}
                      found)
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {data.headings && data.headings.length > 0 ? (
                  <ol className="space-y-2">
                    {data.headings.map((heading, index) => (
                      <li
                        key={`${index}-${heading}`}
                        className="flex gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold text-muted-foreground shadow-sm">
                          {index + 1}
                        </span>
                        <span className="text-sm leading-relaxed text-foreground">{heading}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
                    <FileText className="mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm text-muted-foreground">No H1 or H2 headings found.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
    </AppMain>
  );
}
