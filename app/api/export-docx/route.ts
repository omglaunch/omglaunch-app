import { NextResponse } from 'next/server';
import { convertMarkdownToDocx } from '@mohtasham/md-to-docx';
import { buildExportFilename } from '@/lib/export-article';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ExportDocxRequest = {
  markdown: string;
  title?: string;
};

function isExportDocxRequest(body: unknown): body is ExportDocxRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as ExportDocxRequest).markdown === 'string'
  );
}

async function toBuffer(docxResult: Blob | Buffer | ArrayBuffer): Promise<Buffer> {
  if (Buffer.isBuffer(docxResult)) {
    return docxResult;
  }

  if (docxResult instanceof Blob) {
    return Buffer.from(await docxResult.arrayBuffer());
  }

  return Buffer.from(docxResult);
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isExportDocxRequest(body)) {
    return NextResponse.json({ error: 'markdown is required' }, { status: 400 });
  }

  const markdown = body.markdown.trim();
  if (!markdown) {
    return NextResponse.json({ error: 'markdown is required' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const filename = buildExportFilename(title || 'article', 'docx');

  try {
    const docxResult = await convertMarkdownToDocx(markdown);
    const buffer = await toBuffer(docxResult);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DOCX export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
