import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  requireWorkspaceId,
  runWithAuthenticatedTenantScope,
} from '@/lib/projects/tenant-scope';
import { fetchGbpReviews } from '@/lib/google/gbp-oauth';
import { generateReviewReply } from '@/lib/local-dominance/llm-engines';
import { getPrisma } from '@/lib/prisma';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { deductCredits, isInsufficientCreditsError } from '@/lib/credits';
import { REVIEW_RESPONSE_CREDIT_COST } from '@/lib/local-dominance/constants';
import { resolveLlmCredential } from '@/lib/llm/credentials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return await runWithAuthenticatedTenantScope(async () => {
      const workspaceId = await requireWorkspaceId();
      const config = await getPrisma().integrationConfig.findFirst({
        where: { workspaceId },
      });

      if (!config?.googleBusinessProfileConnected) {
        return NextResponse.json({ reviews: [], connected: false });
      }

      const accountId = process.env.GBP_ACCOUNT_ID?.trim() ?? 'me';
      const locationId = config.googleBusinessProfileLocationId ?? '';

      if (!locationId) {
        return NextResponse.json({ reviews: [], connected: true, locationMissing: true });
      }

      const reviews = await fetchGbpReviews(workspaceId, accountId, locationId);
      return NextResponse.json({ reviews, connected: true });
    });
  } catch (error) {
    console.error('[local-dominance/reviews]', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

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

    const body = (await request.json()) as { reviewText?: string; rating?: number };
    if (!body.reviewText?.trim() || typeof body.rating !== 'number') {
      return NextResponse.json({ error: 'reviewText and rating are required' }, { status: 400 });
    }

    const reviewText = body.reviewText.trim();
    const rating = body.rating;

    return await runWithAuthenticatedTenantScope(async () => {
      const workspaceId = await requireWorkspaceId();
      const aiConfig = await getPrisma().aiConfig.findFirst({ where: { workspaceId } });
      const model = aiConfig?.localDominanceModel ?? 'gpt-4o-mini';

      const llmCred = await resolveLlmCredential(
        workspaceId,
        model.startsWith('claude') ? 'anthropic' : model.startsWith('gpt') ? 'openai' : 'gemini'
      );
      if (llmCred?.usesCredits) {
        await deductCredits(session.user!.id, REVIEW_RESPONSE_CREDIT_COST, 'LOCAL_DOMINANCE_REVIEW_REPLY');
      }

      const reply = await generateReviewReply(
        workspaceId,
        reviewText,
        rating,
        aiConfig?.brandVoice ?? '',
        model
      );

      return NextResponse.json({ reply });
    });
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
    console.error('[local-dominance/reviews/respond]', error);
    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 });
  }
}
