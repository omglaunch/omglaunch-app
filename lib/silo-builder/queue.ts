import { Client } from '@upstash/qstash';

function resolveAppBaseUrl(): string | null {
  const baseUrl =
    process.env.RANK_TRACKER_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (!baseUrl) {
    return null;
  }

  return baseUrl.replace(/\/+$/, '');
}

function shouldUseQStash(): boolean {
  const qstashToken = process.env.QSTASH_TOKEN?.trim();
  const baseUrl = resolveAppBaseUrl();

  if (!qstashToken || !baseUrl) {
    return false;
  }

  // Local/ngrok dev: process inline so jobs are not lost when the tunnel is down.
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }

  return true;
}

export type SiloGenerationMode = 'inline' | 'qstash';

export function getSiloGenerationMode(): SiloGenerationMode {
  return shouldUseQStash() ? 'qstash' : 'inline';
}

export async function enqueueSiloGenerationJobs(
  workspaceId: string,
  userId: string,
  projectId: string,
  nodeIds: string[],
  articleStudioProjectId?: string | null
): Promise<SiloGenerationMode> {
  if (shouldUseQStash()) {
    const client = new Client({ token: process.env.QSTASH_TOKEN!.trim() });
    const baseUrl = resolveAppBaseUrl()!;

    await Promise.all(
      nodeIds.map(nodeId =>
        client.publishJSON({
          url: `${baseUrl}/api/qstash/silo-generate`,
          body: {
            nodeId,
            projectId,
            workspaceId,
            userId,
            articleStudioProjectId: articleStudioProjectId?.trim() || undefined,
          },
          retries: 3,
        })
      )
    );

    return 'qstash';
  }

  const { processSiloNodeGeneration } = await import('./process-generation');
  for (const nodeId of nodeIds) {
    await processSiloNodeGeneration(
      nodeId,
      projectId,
      workspaceId,
      userId,
      articleStudioProjectId
    );
  }

  return 'inline';
}
