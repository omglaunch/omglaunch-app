import { NextResponse } from 'next/server';
import {
  deductCredits,
  isInsufficientCreditsError,
} from '@/lib/credits';
import {
  getAuthenticatedSession,
  getAuthenticatedWorkspaceId,
  isUnauthenticatedError,
} from '@/lib/projects/authenticated-workspace';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { resolveLlmCredential } from '@/lib/llm/credentials';
import { withBackgroundTask } from '@/lib/admin/integration-logging';
import { IntegrationCircuitOpenError } from '@/lib/admin/circuit-breaker';
import { generateKeywordSiloMap } from '@/lib/silo-builder/keyword-engine';
import { persistKeywordSiloProject } from '@/lib/silo-builder/persist';
import { runSiloMetricsEnrichInBackground } from '@/lib/silo-builder/enrich-metrics';
import { resolveKeywordSiloNiche } from '@/lib/silo-builder/resolve-niche';
import { SILO_KEYWORD_MAP_CREDIT_COST } from '@/lib/silo-builder/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

type KeywordMapBody = {
  seedKeyword?: string;
  niche?: string;
  geography?: string;
  integrationId?: string;
  title?: string;
};

export async function POST(request: Request) {
  let body: KeywordMapBody;

  try {
    body = (await request.json()) as KeywordMapBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const seedKeyword = body.seedKeyword?.trim();

  if (!seedKeyword) {
    return NextResponse.json({ error: 'seedKeyword is required' }, { status: 400 });
  }

  const niche = resolveKeywordSiloNiche(seedKeyword, body.niche);

  try {
    const session = await getAuthenticatedSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const workspaceId = await getAuthenticatedWorkspaceId();

    const rateLimit = await checkUserRateLimit(userId);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const llmCred = await resolveLlmCredential(workspaceId, 'gemini');
    if (!llmCred) {
      return NextResponse.json({ error: 'Gemini credentials not configured' }, { status: 500 });
    }

    return await withBackgroundTask(
      {
        userId,
        taskType: 'SILO_KEYWORD_MAP',
        metadata: { seedKeyword, niche },
      },
      async () => {
        if (llmCred.usesCredits) {
          await deductCredits(userId, SILO_KEYWORD_MAP_CREDIT_COST, 'SILO_KEYWORD_MAP');
        }

        const map = await generateKeywordSiloMap(
          workspaceId,
          seedKeyword,
          niche,
          body.geography?.trim()
        );

        const project = await persistKeywordSiloProject(
          {
            userId,
            workspaceId,
            integrationId: body.integrationId?.trim(),
            type: 'KEYWORD',
            title: body.title?.trim() || `Silo: ${seedKeyword}`,
            seedKeyword,
            niche,
            geography: body.geography?.trim(),
          },
          map
        );

        // Background enrich acquires the project lock and sets metricsStatus=enriching.
        runSiloMetricsEnrichInBackground(project.id, workspaceId);

        return NextResponse.json({
          project: {
            ...project,
            metricsStatus: 'enriching' as const,
          },
          metricsEnriching: true,
        });
      }
    );
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof IntegrationCircuitOpenError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (isInsufficientCreditsError(error)) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    const message = error instanceof Error ? error.message : 'Keyword map generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
