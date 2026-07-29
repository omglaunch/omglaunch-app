import type {
  AiVisibilityShareSnapshot,
  ClientShareSnapshotMeta,
  PageAuditShareSnapshot,
  RankTrackerShareSnapshot,
} from '@/lib/client-share/types';
import { formatRankDelta } from '@/lib/client-share/build-snapshots';

function ShareReportShell({
  meta,
  reportLabel,
  children,
}: {
  meta: ClientShareSnapshotMeta;
  reportLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-8 text-center">
        {meta.reportLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meta.reportLogoUrl}
            alt=""
            className="mx-auto mb-4 h-10 w-auto object-contain"
          />
        ) : null}
        <p className="text-xs uppercase tracking-widest text-slate-500">{reportLabel}</p>
        <h1 className="mt-2 text-3xl font-bold">{meta.clientBrandLabel}</h1>
        <p className="mt-1 text-sm text-slate-400">{meta.projectName}</p>
        <p className="mt-1 text-xs text-slate-500">
          Snapshot {new Date(meta.generatedAt).toLocaleString()}
        </p>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      <footer className="border-t border-slate-800 px-6 py-6 text-center text-xs text-slate-500">
        {meta.clientBrandLabel} · Prepared by {meta.agencyName} · Read-only client report
      </footer>
    </div>
  );
}

export function RankTrackerShareReport({ snapshot }: { snapshot: RankTrackerShareSnapshot }) {
  return (
    <ShareReportShell meta={snapshot.meta} reportLabel="Rank Tracker Snapshot">
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Visibility score" value={`${snapshot.summary.visibilityScore}%`} />
        <MetricCard label="Average rank" value={snapshot.summary.averageRank} />
        <MetricCard label="Top 3 keywords" value={String(snapshot.summary.top3Count)} />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Keyword</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Volume</th>
              <th className="px-4 py-3">Intent</th>
              <th className="px-4 py-3">Location</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.keywords.map(row => (
              <tr key={row.keyword} className="border-t border-slate-800">
                <td className="px-4 py-3 font-medium">{row.keyword}</td>
                <td className="px-4 py-3">
                  {formatRankDelta(row.currentRank, row.previousRank)}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {row.searchVolume?.toLocaleString() ?? '—'}
                </td>
                <td className="px-4 py-3 text-slate-400">{row.intent}</td>
                <td className="px-4 py-3 text-slate-400">{row.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ShareReportShell>
  );
}

export function AiVisibilityShareReport({ snapshot }: { snapshot: AiVisibilityShareSnapshot }) {
  return (
    <ShareReportShell meta={snapshot.meta} reportLabel="AI Visibility Summary">
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Citation share"
          value={`${(snapshot.metrics.totalCitationShare * 100).toFixed(1)}%`}
        />
        <MetricCard
          label="Top-3 citations"
          value={String(snapshot.metrics.top3CitationsSecured)}
        />
        <MetricCard
          label="Prompt clusters"
          value={String(snapshot.metrics.promptClustersTracked)}
        />
        <MetricCard
          label="Active prompts"
          value={String(snapshot.metrics.activeNonSuspendedPrompts)}
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Prompt</th>
              <th className="px-4 py-3">Cluster</th>
              <th className="px-4 py-3">Geo</th>
              <th className="px-4 py-3">Google AIO</th>
              <th className="px-4 py-3">Perplexity</th>
              <th className="px-4 py-3">ChatGPT</th>
              <th className="px-4 py-3">Claude</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.rows.map(row => (
              <tr key={`${row.prompt}-${row.geoTarget}`} className="border-t border-slate-800">
                <td className="px-4 py-3 font-medium">{row.prompt}</td>
                <td className="px-4 py-3 text-slate-400">{row.promptCluster}</td>
                <td className="px-4 py-3 text-slate-400">{row.geoTarget}</td>
                <td className="px-4 py-3 text-slate-300">{row.googleAio}</td>
                <td className="px-4 py-3 text-slate-300">{row.perplexity}</td>
                <td className="px-4 py-3 text-slate-300">{row.chatgpt}</td>
                <td className="px-4 py-3 text-slate-300">{row.claude}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ShareReportShell>
  );
}

export function PageAuditShareReport({ snapshot }: { snapshot: PageAuditShareSnapshot }) {
  const { audit } = snapshot;

  return (
    <ShareReportShell meta={snapshot.meta} reportLabel="Page Audit Report">
      <div className="mb-6 grid gap-4 lg:grid-cols-[180px_1fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">GEO Score</p>
          <p className="mt-2 text-5xl font-bold text-emerald-300">{audit.geoScore.toFixed(0)}</p>
        </div>
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Target keyword</p>
          <p className="text-lg font-semibold">{audit.targetKeyword}</p>
          <p className="truncate text-sm text-slate-400">{audit.url}</p>
          <p className="text-xs text-slate-500">
            Audited {new Date(audit.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {audit.title || audit.wordCount ? (
        <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Page</h2>
          {audit.title ? <p className="mt-2 text-lg font-medium">{audit.title}</p> : null}
          {audit.wordCount ? (
            <p className="mt-1 text-sm text-slate-400">{audit.wordCount.toLocaleString()} words</p>
          ) : null}
          {audit.headings.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {audit.headings.map(heading => (
                <li key={heading}>{heading}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {audit.analysisExcerpt ? (
        <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Summary</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {audit.analysisExcerpt}
          </p>
        </section>
      ) : null}

      {audit.actionPlan.length > 0 ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Recommended actions
          </h2>
          <div className="mt-4 space-y-4">
            {audit.actionPlan.map(item => (
              <div key={item.title} className="border-t border-slate-800 pt-4 first:border-t-0 first:pt-0">
                <p className="font-medium text-white">{item.title}</p>
                <p className="mt-1 text-sm text-slate-400">{item.reasoning}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </ShareReportShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
