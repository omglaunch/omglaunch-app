import { getPrisma } from '@/lib/prisma';
import { generateServiceAreaPage } from './llm-engines';
import { generateGeoTaggedImage, cleanupTempImage } from './exif-image';
import { publishGbpLocalPost } from '@/lib/google/gbp-oauth';
import { deductCredits } from '@/lib/credits';
import { SERVICE_AREA_CREDIT_COST_PER_CITY } from './constants';
import { resolveLlmCredential } from '@/lib/llm/credentials';

type WordPressCredentials = {
  siteUrl: string;
  username: string;
  appPassword: string;
};

async function resolveWordPressCredentials(
  workspaceId: string
): Promise<WordPressCredentials | null> {
  const config = await getPrisma().integrationConfig.findFirst({
    where: { workspaceId },
    select: {
      wordpressSiteUrl: true,
      wordpressUsername: true,
      wordpressAppPassword: true,
    },
  });

  if (
    !config?.wordpressSiteUrl?.trim() ||
    !config.wordpressUsername?.trim() ||
    !config.wordpressAppPassword?.trim()
  ) {
    return null;
  }

  return {
    siteUrl: config.wordpressSiteUrl.trim(),
    username: config.wordpressUsername.trim(),
    appPassword: config.wordpressAppPassword.replace(/\s+/g, ''),
  };
}

function normalizeWordPressSiteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '')}`;
}

async function publishToWordPress(
  creds: WordPressCredentials,
  title: string,
  htmlContent: string,
  jsonLd: Record<string, unknown>
): Promise<{ postId: number; postUrl: string }> {
  const siteUrl = normalizeWordPressSiteUrl(creds.siteUrl);
  const auth = Buffer.from(`${creds.username}:${creds.appPassword}`).toString('base64');

  const response = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      content: htmlContent,
      status: 'publish',
      meta: {
        _yoast_wpseo_schema_page_type: 'WebPage',
        _rank_math_schema: JSON.stringify(jsonLd),
        omglaunch_json_ld: JSON.stringify(jsonLd),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`WordPress publish failed (${response.status})`);
  }

  const data = (await response.json()) as { id?: number; link?: string };
  return { postId: data.id ?? 0, postUrl: data.link ?? siteUrl };
}

export async function processServiceAreaJob(
  jobId: string,
  workspaceId: string
): Promise<void> {
  const prisma = getPrisma();
  const job = await prisma.serviceAreaPageJob.findFirst({
    where: { id: jobId, workspaceId },
  });

  if (!job || job.status === 'COMPLETED') return;

  await prisma.serviceAreaPageJob.updateMany({
    where: { id: jobId },
    data: { status: 'PROCESSING' },
  });

  try {
    const aiConfig = await prisma.aiConfig.findFirst({ where: { workspaceId } });
    const model = job.llmModel ?? aiConfig?.localDominanceModel ?? 'gpt-4o-mini';
    const brandVoice = aiConfig?.brandVoice ?? '';

    const llmCred = await resolveLlmCredential(
      workspaceId,
      model.startsWith('claude') ? 'anthropic' : model.startsWith('gpt') ? 'openai' : 'gemini'
    );
    if (llmCred?.usesCredits) {
      await deductCredits(job.userId, SERVICE_AREA_CREDIT_COST_PER_CITY, 'LOCAL_DOMINANCE_SERVICE_AREA');
    }

    const { html, jsonLd } = await generateServiceAreaPage(
      workspaceId,
      job.coreService,
      job.targetCity,
      model,
      brandVoice
    );

    let mediaUrl: string | undefined;
    if (job.centralLat != null && job.centralLng != null) {
      const { tempPath } = await generateGeoTaggedImage(
        job.centralLat,
        job.centralLng,
        `${job.coreService} in ${job.targetCity}`
      );
      await cleanupTempImage(tempPath);
    }

    const wpCreds = await resolveWordPressCredentials(workspaceId);
    let wordpressPostId: number | undefined;
    let wordpressPostUrl: string | undefined;

    if (wpCreds) {
      const title = `${job.coreService} in ${job.targetCity}`;
      const published = await publishToWordPress(wpCreds, title, html, jsonLd);
      wordpressPostId = published.postId;
      wordpressPostUrl = published.postUrl;
    }

    const integration = await prisma.integrationConfig.findFirst({
      where: { workspaceId },
      select: { googleBusinessProfileLocationId: true },
    });

    let gbpPostId: string | null = null;
    if (integration?.googleBusinessProfileLocationId) {
      gbpPostId = await publishGbpLocalPost(
        workspaceId,
        integration.googleBusinessProfileLocationId,
        `${job.coreService} now serving ${job.targetCity}!`,
        mediaUrl
      );
    }

    await prisma.serviceAreaPageJob.updateMany({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        htmlContent: html,
        jsonLdSchema: jsonLd as object,
        wordpressPostId,
        wordpressPostUrl,
        gbpPostId,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed';
    await prisma.serviceAreaPageJob.updateMany({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage: message },
    });
    throw error;
  }
}
