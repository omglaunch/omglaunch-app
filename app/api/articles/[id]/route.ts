import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type UpdateArticleRequest = {
  title?: string;
  content?: string;
};

function extractTitleFromMarkdown(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const articleId = Number.parseInt(params.id, 10);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    return NextResponse.json({ error: 'Invalid article id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = body as UpdateArticleRequest;
  if (typeof payload !== 'object' || payload === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (payload.content !== undefined && typeof payload.content !== 'string') {
    return NextResponse.json({ error: 'content must be a string' }, { status: 400 });
  }

  if (payload.title !== undefined && typeof payload.title !== 'string') {
    return NextResponse.json({ error: 'title must be a string' }, { status: 400 });
  }

  if (payload.content === undefined && payload.title === undefined) {
    return NextResponse.json({ error: 'title or content is required' }, { status: 400 });
  }

  const existing = await prisma.article.findUnique({
    where: { id: articleId },
    include: { brief: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  const content = payload.content ?? existing.content;
  const title =
    payload.title ??
    extractTitleFromMarkdown(content, existing.brief.targetKeyword);

  try {
    const article = await prisma.article.update({
      where: { id: articleId },
      data: { title, content },
    });

    return NextResponse.json({ article });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save article';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
