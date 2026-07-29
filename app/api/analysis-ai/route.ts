import { NextResponse } from 'next/server';
import { runPageAnalysis } from '@/lib/analysis/run-page-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AnalysisRequest = {
  url: string;
};

function isAnalysisRequest(body: unknown): body is AnalysisRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as AnalysisRequest).url === 'string'
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isAnalysisRequest(body)) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  const trimmedUrl = body.url.trim();
  if (!trimmedUrl) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  try {
    const result = await runPageAnalysis(trimmedUrl);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run analysis';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
