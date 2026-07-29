import { NextResponse } from 'next/server';
import { marked } from 'marked';
import {
  formatWordPressPublishError,
  normalizeWordPressSiteUrl,
  verifyWordPressCredentials,
  wordpressAuthenticatedFetch,
} from '@/lib/wordpress-rest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PublishWordPressRequest = {
  title: string;
  content: string;
  url: string;
  username: string;
  password: string;
  publishLive: boolean;
};

function isPublishWordPressRequest(body: unknown): body is PublishWordPressRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const candidate = body as PublishWordPressRequest;

  return (
    typeof candidate.title === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.password === 'string' &&
    typeof candidate.publishLive === 'boolean'
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isPublishWordPressRequest(body)) {
    return NextResponse.json(
      { error: 'title, content, url, username, password, and publishLive are required' },
      { status: 400 }
    );
  }

  const { title, content, url, username, password, publishLive } = body;

  if (!title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  if (!content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  if (!username.trim()) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 });
  }

  if (!password.trim()) {
    return NextResponse.json({ error: 'application password is required' }, { status: 400 });
  }

  let siteUrl: string;
  try {
    siteUrl = normalizeWordPressSiteUrl(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid WordPress site URL';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const auth = {
    username: username.trim(),
    applicationPassword: password,
  };

  try {
    const verified = await verifyWordPressCredentials(siteUrl, auth);
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: 401 });
    }

    const htmlContent = await marked.parse(content);
    const result = await wordpressAuthenticatedFetch(siteUrl, auth, '/wp-json/wp/v2/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: title.trim(),
        content: htmlContent,
        status: publishLive ? 'publish' : 'draft',
      }),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: formatWordPressPublishError(result.payload, result.status) },
        { status: result.status >= 400 && result.status < 600 ? result.status : 502 }
      );
    }

    const postId = typeof result.payload.id === 'number' ? result.payload.id : null;
    if (!postId) {
      return NextResponse.json({ error: 'WordPress returned an unexpected response' }, { status: 502 });
    }

    const editUrl = `${siteUrl}/wp-admin/post.php?post=${postId}&action=edit`;
    const viewUrl =
      publishLive && typeof result.payload.link === 'string'
        ? result.payload.link
        : editUrl;

    return NextResponse.json({
      id: postId,
      status:
        typeof result.payload.status === 'string'
          ? result.payload.status
          : publishLive
            ? 'publish'
            : 'draft',
      viewUrl,
      editUrl,
      isLive: publishLive,
      authenticatedAs: verified.name,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'WordPress publishing failed. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
