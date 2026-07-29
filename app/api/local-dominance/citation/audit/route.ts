import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  requireWorkspaceId,
  runWithAuthenticatedTenantScope,
} from '@/lib/projects/tenant-scope';
import { searchBrandCitations, resolveDataForSeoCredentials } from '@/lib/local-dominance/dataforseo-maps';
import { auditNapConsistency } from '@/lib/local-dominance/llm-engines';
import { getPrisma } from '@/lib/prisma';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { deductCredits, isInsufficientCreditsError } from '@/lib/credits';
import { CITATION_AUDIT_CREDIT_COST } from '@/lib/local-dominance/constants';
import { resolveLlmCredential } from '@/lib/llm/credentials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    const body = (await request.json()) as {
      brandName?: string;
      address?: string;
      phone?: string;
    };

    if (!body.brandName?.trim() || !body.address?.trim() || !body.phone?.trim()) {
      return NextResponse.json(
        { error: 'brandName, address, and phone are required' },
        { status: 400 }
      );
    }

    return await runWithAuthenticatedTenantScope(async () => {
      const workspaceId = await requireWorkspaceId();
      const credentials = await resolveDataForSeoCredentials(workspaceId);
      if (!credentials) {
        return NextResponse.json(
          { error: 'DataForSEO credentials are not configured' },
          { status: 503 }
        );
      }

      const aiConfig = await getPrisma().aiConfig.findFirst({ where: { workspaceId } });
      const model = aiConfig?.analysisAiModel ?? 'gpt-4o-mini';

      const llmCred = await resolveLlmCredential(workspaceId, 'openai');
      if (llmCred?.usesCredits) {
        await deductCredits(session.user!.id, CITATION_AUDIT_CREDIT_COST, 'LOCAL_DOMINANCE_CITATION_AUDIT');
      }

      const citations = await searchBrandCitations(body.brandName!.trim(), credentials);
      const entries = await auditNapConsistency(
        workspaceId,
        body.brandName!.trim(),
        body.address!.trim(),
        body.phone!.trim(),
        citations,
        model
      );

      const consistent = entries.filter(e => e.napMatch === 'consistent').length;
      const inconsistent = entries.filter(e => e.napMatch === 'inconsistent').length;
      const partial = entries.filter(e => e.napMatch === 'partial').length;

      return NextResponse.json({
        citationsFound: citations.length,
        consistent,
        inconsistent,
        missing: Math.max(0, citations.length - entries.length),
        partial,
        entries,
      });
    });
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
    console.error('[local-dominance/citation/audit]', error);
    return NextResponse.json({ error: 'Citation audit failed' }, { status: 500 });
  }
}
