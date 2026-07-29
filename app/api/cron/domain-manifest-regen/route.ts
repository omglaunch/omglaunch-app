import { NextResponse } from 'next/server';
import { processDueDomainManifestRegens } from '@/lib/domain-profile/debounced-regen';
import { withBackgroundTask } from '@/lib/admin/integration-logging';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

function verifyCronAuthorization(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authorization = request.headers.get('authorization');
  if (authorization === `Bearer ${secret}`) return true;

  const cronSignature = request.headers.get('x-cron-signature');
  return cronSignature === secret;
}

export async function GET(request: Request) {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withBackgroundTask(
    {
      userId: 'system:cron',
      taskType: 'DOMAIN_MANIFEST_REGEN_CRON',
      metadata: { source: 'cron/domain-manifest-regen' },
    },
    async () => {
      const result = await processDueDomainManifestRegens({ limit: 50 });
      return NextResponse.json({
        ok: true,
        ...result,
      });
    }
  );
}
