import { notFound } from 'next/navigation';
import SharePasswordGate from '@/components/client-share/SharePasswordGate';
import {
  AiVisibilityShareReport,
  PageAuditShareReport,
  RankTrackerShareReport,
} from '@/components/client-share/ShareReportViews';
import { resolvePublicClientShare } from '@/lib/client-share/service';
import type {
  AiVisibilityShareSnapshot,
  PageAuditShareSnapshot,
  RankTrackerShareSnapshot,
} from '@/lib/client-share/types';

type PageProps = {
  params: { shareToken: string };
};

export const dynamic = 'force-dynamic';

function ShareUnavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-slate-200">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

export default async function PublicClientSharePage({ params }: PageProps) {
  const resolved = await resolvePublicClientShare(params.shareToken);

  if (resolved.status === 'not_found') {
    notFound();
  }

  if (resolved.status === 'revoked') {
    return (
      <ShareUnavailable
        title="Link revoked"
        detail="This client report link was revoked by the agency."
      />
    );
  }

  if (resolved.status === 'expired') {
    return (
      <ShareUnavailable
        title="Link expired"
        detail="This client report link has expired. Ask your agency for a new link."
      />
    );
  }

  if (resolved.status === 'password_required') {
    return <SharePasswordGate shareToken={params.shareToken} />;
  }

  const { share } = resolved;

  switch (share.reportType) {
    case 'rank_tracker':
      return (
        <RankTrackerShareReport snapshot={share.snapshot as RankTrackerShareSnapshot} />
      );
    case 'ai_visibility':
      return (
        <AiVisibilityShareReport snapshot={share.snapshot as AiVisibilityShareSnapshot} />
      );
    case 'page_audit':
      return <PageAuditShareReport snapshot={share.snapshot as PageAuditShareSnapshot} />;
    default:
      notFound();
  }
}
