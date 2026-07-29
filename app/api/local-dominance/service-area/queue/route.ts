import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  requireWorkspaceId,
  runWithAuthenticatedTenantScope,
} from '@/lib/projects/tenant-scope';
import { enqueueServiceAreaJobs, processServiceAreaJobInline } from '@/lib/local-dominance/queue';
import { getPrisma } from '@/lib/prisma';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { isInsufficientCreditsError } from '@/lib/credits';
import { SERVICE_AREA_CREDIT_COST_PER_CITY } from '@/lib/local-dominance/constants';
import { deductCredits } from '@/lib/credits';
import { resolveLlmCredential } from '@/lib/llm/credentials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type QueueBody = {
  coreService?: string;
  targetCities?: string[];
  clientCid?: string;
  centralLat?: number;
  centralLng?: number;
};

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkUserRateLimit(session.user.id);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = (await request.json()) as QueueBody;
    if (!body.coreService?.trim() || !body.targetCities?.length) {
      return NextResponse.json(
        { error: 'coreService and targetCities are required' },
        { status: 400 }
      );
    }

    const targetCities = body.targetCities;
    const coreService = body.coreService.trim();

    return await runWithAuthenticatedTenantScope(async () => {
      const workspaceId = await requireWorkspaceId();
      const aiConfig = await getPrisma().aiConfig.findFirst({ where: { workspaceId } });
      const model = aiConfig?.localDominanceModel ?? 'gpt-4o-mini';

      const llmCred = await resolveLlmCredential(
        workspaceId,
        model.startsWith('claude') ? 'anthropic' : model.startsWith('gpt') ? 'openai' : 'gemini'
      );

      if (llmCred?.usesCredits) {
        const totalCost = targetCities.length * SERVICE_AREA_CREDIT_COST_PER_CITY;
        await deductCredits(session.user!.id, totalCost, 'LOCAL_DOMINANCE_SERVICE_AREA_QUEUE');
      }

      const jobs = targetCities.map(city => ({
        coreService,
        targetCity: city.trim(),
        clientCid: body.clientCid,
        centralLat: body.centralLat,
        centralLng: body.centralLng,
        llmModel: model,
      }));

      const jobIds = await enqueueServiceAreaJobs(workspaceId, session.user!.id, jobs);

      if (!process.env.QSTASH_TOKEN?.trim()) {
        for (const jobId of jobIds) {
          void processServiceAreaJobInline(jobId, workspaceId).catch(console.error);
        }
      }

      return NextResponse.json({ jobIds, queued: jobIds.length });
    });
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
    console.error('[local-dominance/service-area/queue]', error);
    return NextResponse.json({ error: 'Failed to queue jobs' }, { status: 500 });
  }
}
