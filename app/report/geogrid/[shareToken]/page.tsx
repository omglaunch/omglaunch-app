import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { serializeBrandProfile } from '@/lib/ai-visibility/aeo-brand-profile';
import { resolveClientBrandLabel } from '@/lib/projects/client-brand';
import GeogridHeatMap from '@/components/local-dominance/GeogridHeatMap';
import type { GridCell } from '@/lib/local-dominance/types';

type PageProps = {
  params: { shareToken: string };
};

export const dynamic = 'force-dynamic';

export default async function PublicGeogridReportPage({ params }: PageProps) {
  const audit = await prisma.localAuditHistory.findUnique({
    where: { shareToken: params.shareToken },
    include: {
      project: {
        select: {
          name: true,
          domain: true,
          aeoBrandProfile: true,
        },
      },
    },
  });

  if (!audit) {
    notFound();
  }

  const workspace = await prisma.workspaceSettings.findFirst({
    where: { workspaceId: audit.workspaceId },
    select: { name: true, reportLogoUrl: true },
  });

  const profile = audit.project.aeoBrandProfile
    ? serializeBrandProfile(audit.project.aeoBrandProfile)
    : null;

  const clientBrand = resolveClientBrandLabel({
    brandLabel: profile?.brandLabel ?? audit.businessName,
    projectName: audit.project.name,
    fallback: audit.keyword,
  });
  const agencyName = workspace?.name?.trim() || 'Agency';
  const cells = audit.gridResults as GridCell[];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-8 text-center">
        <p className="text-xs uppercase tracking-widest text-slate-500">Local Dominance Report</p>
        <h1 className="mt-2 text-3xl font-bold">{clientBrand}</h1>
        <p className="mt-1 text-sm text-slate-400">{audit.keyword}</p>
        <p className="mt-1 text-slate-400">
          {audit.gridSize}×{audit.gridSize} grid · {audit.platform} ·{' '}
          {new Date(audit.createdAt).toLocaleDateString()}
        </p>
        <div className="mt-4 flex justify-center gap-6">
          <div>
            <p className="text-xs text-emerald-400">SoLV</p>
            <p className="text-2xl font-bold text-emerald-300">{audit.solvScore ?? '—'}%</p>
          </div>
          <div>
            <p className="text-xs text-cyan-400">SAIV</p>
            <p className="text-2xl font-bold text-cyan-300">{audit.saivScore ?? '—'}%</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-8">
        <GeogridHeatMap cells={cells} gridSize={audit.gridSize} />
        <p className="mt-6 text-center text-xs text-slate-600">
          {clientBrand} · Prepared by {agencyName} · Read-only client report
        </p>
      </main>
    </div>
  );
}
