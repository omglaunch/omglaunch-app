import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isMetaDescriptionAcceptable, truncateMetaDescription } from '@/lib/article-metadata';
import {
  generateOptimizedMetaDescription,
  type GenerateOptimizedMetaDescriptionInput,
} from '@/lib/generate-optimized-meta-description';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type OptimizeMetaRequest = {
  targetKeyword: string;
  seoTitle: string;
  articleContent: string;
  briefId?: number;
  existingMeta?: string;
};

function isOptimizeMetaRequest(body: unknown): body is OptimizeMetaRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const candidate = body as OptimizeMetaRequest;
  return (
    typeof candidate.targetKeyword === 'string' &&
    typeof candidate.seoTitle === 'string' &&
    typeof candidate.articleContent === 'string'
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isOptimizeMetaRequest(body)) {
    return NextResponse.json(
      { error: 'targetKeyword, seoTitle, and articleContent are required' },
      { status: 400 }
    );
  }

  const targetKeyword = body.targetKeyword.trim();
  const seoTitle = body.seoTitle.trim();
  const articleContent = body.articleContent.trim();

  if (!targetKeyword || !seoTitle || !articleContent) {
    return NextResponse.json(
      { error: 'targetKeyword, seoTitle, and articleContent cannot be empty' },
      { status: 400 }
    );
  }

  const existingMeta = body.existingMeta?.trim() ?? '';
  if (existingMeta && isMetaDescriptionAcceptable(existingMeta, targetKeyword)) {
    return NextResponse.json({ metaDescription: truncateMetaDescription(existingMeta) });
  }

  let briefContent: string | undefined;
  if (typeof body.briefId === 'number' && Number.isInteger(body.briefId) && body.briefId > 0) {
    const brief = await prisma.contentBrief.findUnique({ where: { id: body.briefId } });
    briefContent = brief?.content;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  }

  try {
    const input: GenerateOptimizedMetaDescriptionInput = {
      targetKeyword,
      seoTitle,
      articleContent,
      briefContent,
    };

    const metaDescription = await generateOptimizedMetaDescription(input, apiKey);
    return NextResponse.json({ metaDescription });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Meta description optimization failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
