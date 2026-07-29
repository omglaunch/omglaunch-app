import { getPrisma } from '@/lib/prisma';
import { Client } from '@upstash/qstash';

function resolveAppBaseUrl(): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (!baseUrl) throw new Error('NEXT_PUBLIC_APP_URL is not configured');
  return baseUrl.replace(/\/+$/, '');
}

export async function enqueueServiceAreaJobs(
  workspaceId: string,
  userId: string,
  jobs: Array<{
    coreService: string;
    targetCity: string;
    clientCid?: string;
    centralLat?: number;
    centralLng?: number;
    llmModel: string;
  }>
): Promise<string[]> {
  const prisma = getPrisma();
  const jobIds: string[] = [];

  for (const job of jobs) {
    const record = await prisma.serviceAreaPageJob.create({
      data: {
        workspaceId,
        userId,
        coreService: job.coreService,
        targetCity: job.targetCity,
        clientCid: job.clientCid,
        centralLat: job.centralLat,
        centralLng: job.centralLng,
        llmModel: job.llmModel,
        status: 'QUEUED',
      },
    });
    jobIds.push(record.id);
  }

  const qstashToken = process.env.QSTASH_TOKEN?.trim();
  if (qstashToken) {
    const client = new Client({ token: qstashToken });
    const baseUrl = resolveAppBaseUrl();

    await Promise.all(
      jobIds.map(jobId =>
        client.publishJSON({
          url: `${baseUrl}/api/local-dominance/service-area/process`,
          body: { jobId, workspaceId },
          retries: 3,
        })
      )
    );
  }

  return jobIds;
}

/** Fallback processor when QStash is not configured — processes inline in dev. */
export async function processServiceAreaJobInline(
  jobId: string,
  workspaceId: string
): Promise<void> {
  const { processServiceAreaJob } = await import('./process-service-area-job');
  await processServiceAreaJob(jobId, workspaceId);
}
