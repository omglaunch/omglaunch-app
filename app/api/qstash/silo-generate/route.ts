import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { runWithTenantScopeAsync } from '@/lib/prisma/tenant-context';
import { processSiloNodeGeneration } from '@/lib/silo-builder/process-generation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

type ProcessBody = {
  nodeId?: string;
  projectId?: string;
  workspaceId?: string;
  userId?: string;
  articleStudioProjectId?: string;
};

async function verifyQStash(request: Request, body: string): Promise<boolean> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  if (!currentSigningKey) return process.env.NODE_ENV !== 'production';

  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey: nextSigningKey ?? currentSigningKey,
  });

  const signature = request.headers.get('upstash-signature') ?? '';
  return receiver.verify({ signature, body });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const verified = await verifyQStash(request, rawBody);
    if (!verified) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as ProcessBody;
    if (!body.nodeId || !body.projectId || !body.workspaceId || !body.userId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await runWithTenantScopeAsync(body.workspaceId, async () => {
      await processSiloNodeGeneration(
        body.nodeId!,
        body.projectId!,
        body.workspaceId!,
        body.userId!,
        body.articleStudioProjectId
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[qstash/silo-generate]', error);
    const message = error instanceof Error ? error.message : 'Processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
