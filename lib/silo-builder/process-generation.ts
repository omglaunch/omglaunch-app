import { GoogleGenAI } from '@google/genai';
import { getPrisma } from '@/lib/prisma';
import { deductCredits } from '@/lib/credits';
import { resolveLlmCredential } from '@/lib/llm/credentials';
import { withIntegrationTelemetry } from '@/lib/admin/integration-telemetry';
import { SILO_CONTENT_GENERATION_CREDIT_COST, SILO_GEMINI_MODEL } from '@/lib/silo-builder/constants';
import { normalizeGeneratedArticleContent } from '@/lib/silo-builder/html-to-markdown';
import { syncSiloNodeToArticleStudio } from '@/lib/silo-builder/article-studio-sync';
import {
  assertSiloProjectAccess,
} from '@/lib/silo-builder/security';
import { getServerActiveProjectId } from '@/lib/projects/active-project-server';

type WordPressCredentials = {
  siteUrl: string;
  username: string;
  appPassword: string;
};

function normalizeWordPressSiteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '')}`;
}

async function resolveWordPressCredentials(
  integrationId: string | null,
  workspaceId: string
): Promise<WordPressCredentials | null> {
  const prisma = getPrisma();

  const config = integrationId
    ? await prisma.integrationConfig.findFirst({
        where: { id: integrationId, workspaceId },
        select: {
          wordpressSiteUrl: true,
          wordpressUsername: true,
          wordpressAppPassword: true,
        },
      })
    : await prisma.integrationConfig.findFirst({
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

async function publishToWordPress(
  creds: WordPressCredentials,
  title: string,
  htmlContent: string
): Promise<{ postId: number; slug: string; postUrl: string }> {
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
      status: 'draft',
    }),
  });

  if (!response.ok) {
    throw new Error(`WordPress publish failed (${response.status})`);
  }

  const data = (await response.json()) as {
    id?: number;
    slug?: string;
    link?: string;
  };

  return {
    postId: data.id ?? 0,
    slug: data.slug ?? '',
    postUrl: data.link ?? siteUrl,
  };
}

async function generateNodeContent(
  workspaceId: string,
  nodeType: 'PILLAR' | 'SPOKE',
  title: string,
  targetKeyword: string,
  intent: string | null,
  summary: string | null,
  projectContext: { seedKeyword?: string | null; domain?: string | null; niche?: string | null }
): Promise<string> {
  const cred = await resolveLlmCredential(workspaceId, 'gemini');
  if (!cred) throw new Error('Gemini credentials not configured.');

  const ai = new GoogleGenAI({ apiKey: cred.apiKey });

  const isPillar = nodeType === 'PILLAR';
  const prompt = [
    isPillar
      ? `Write a comprehensive pillar hub page in HTML format. This is the central authority page for the entire content silo — broader and more definitive than cluster articles.`
      : `Write a comprehensive SEO cluster article in HTML format.`,
    `Title: ${title}`,
    `Target Keyword: ${targetKeyword}`,
    intent ? `Search Intent: ${intent}` : '',
    summary ? `Page Overview: ${summary}` : '',
    projectContext.seedKeyword ? `Silo Seed: ${projectContext.seedKeyword}` : '',
    projectContext.domain ? `Competitor Domain: ${projectContext.domain}` : '',
    projectContext.niche ? `Niche: ${projectContext.niche}` : '',
    '',
    isPillar
      ? 'Structure as a definitive hub: strong intro establishing topical authority, 4-6 major sections covering the silo theme, FAQ or summary block, and natural internal-link placeholders for related cluster pages. Aim for 1,800-2,500 words of depth. Use semantic HTML (h2, h3, p, ul, li). Return only HTML body content — no markdown fences, no ``` blocks.'
      : 'Use semantic HTML (h2, h3, p, ul, li). Include the target keyword naturally. Return only HTML body content — no markdown fences, no ``` blocks.',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await withIntegrationTelemetry(
    {
      integrationType: 'GEMINI',
      targetUrl: SILO_GEMINI_MODEL,
      workspaceId,
      operation: 'silo_content_generation',
    },
    () =>
      ai.models.generateContent({
        model: SILO_GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'text/plain',
        },
      })
  );

  const text = response.text?.trim();
  if (!text) throw new Error('Gemini returned empty content.');

  return normalizeGeneratedArticleContent(text);
}

export async function processSiloNodeGeneration(
  nodeId: string,
  projectId: string,
  workspaceId: string,
  userId: string,
  articleStudioProjectId?: string | null
): Promise<void> {
  const prisma = getPrisma();
  await assertSiloProjectAccess(projectId, workspaceId);

  const node = await prisma.siloNode.findFirst({
    where: { id: nodeId, projectId },
    include: { project: true },
  });

  if (!node || node.status === 'COMPLETED') return;

  await prisma.siloNode.updateMany({
    where: { id: nodeId },
    data: { status: 'GENERATING' },
  });

  try {
    const llmCred = await resolveLlmCredential(workspaceId, 'gemini');
    if (llmCred?.usesCredits) {
      await deductCredits(
        userId,
        SILO_CONTENT_GENERATION_CREDIT_COST,
        'SILO_CONTENT_GENERATION'
      );
    }

    const html = await generateNodeContent(
      workspaceId,
      node.type as 'PILLAR' | 'SPOKE',
      node.title,
      node.targetKeyword ?? node.title,
      node.intent,
      node.summary,
      {
        seedKeyword: node.project.seedKeyword,
        domain: node.project.domain,
        niche: node.project.niche,
      }
    );

    const wpCreds = await resolveWordPressCredentials(
      node.project.integrationId,
      workspaceId
    );

    let wpPostId: number | undefined;
    let slug: string | undefined;

    if (wpCreds) {
      const published = await publishToWordPress(wpCreds, node.title, html);
      wpPostId = published.postId;
      slug = published.slug;
    }

    await prisma.siloNode.updateMany({
      where: { id: nodeId },
      data: {
        status: 'COMPLETED',
        content: html,
        slug: slug ?? null,
        wpPostId: wpPostId ?? null,
        wpPostStatus: wpPostId ? 'draft' : null,
      },
    });

    try {
      const resolvedArticleStudioProjectId =
        articleStudioProjectId?.trim() || (await getServerActiveProjectId());

      if (!resolvedArticleStudioProjectId) {
        console.warn(
          'Skipping Article Studio sync for silo node %s: no active project selected.',
          nodeId
        );
      } else {
        await syncSiloNodeToArticleStudio({
          articleStudioProjectId: resolvedArticleStudioProjectId,
          nodeId,
          projectId,
          projectTitle: node.project.title,
          title: node.title,
          targetKeyword: node.targetKeyword ?? node.title,
          intent: node.intent,
          htmlContent: html,
        });
      }
    } catch (syncError) {
      console.error('Failed to sync Silo Builder article to Article Studio:', syncError);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed';
    await prisma.siloNode.updateMany({
      where: { id: nodeId },
      data: { status: 'FAILED' },
    });
    throw new Error(message);
  }
}
