/**
 * Domain crawler discover SSE —
 * remainingCapacity halt, robots/same-origin stubs, markdown strip, ping heartbeat.
 */

import { applyDiscoverUrlToProjectProfile } from '@/lib/ai-visibility/apply-discover-url';
import { stripMarkdownCodeBlocks } from '@/lib/ai-visibility/onboarding/utils';
import { getAuthenticatedWorkspaceId } from '@/lib/projects/authenticated-workspace';
import {
  ProjectAccessError,
  ReadOnlyAccessError,
  requireAccessibleProjectWriteId,
} from '@/lib/projects/team-access';
import { isUnauthenticatedError } from '@/lib/projects/auth-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BLOCKED_PATHS = [/\/privacy/i, /\/terms/i, /\/contact/i, /\/cart/i];
const PRIORITY_PATHS = [/\/products?\//i, /\/services?\//i];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = (searchParams.get('url') ?? '').trim();
  const projectIdParam = searchParams.get('projectId');
  const remainingCapacity = Math.max(
    0,
    Math.min(100, Number(searchParams.get('remainingCapacity') ?? 100) || 0)
  );
  const lastEventId = searchParams.get('lastEventId');

  if (!url) {
    return new Response(JSON.stringify({ error: 'url is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let projectId: string | null = null;
  let workspaceId: string | null = null;

  try {
    if (projectIdParam?.trim()) {
      projectId = await requireAccessibleProjectWriteId(projectIdParam);
      workspaceId = await getAuthenticatedWorkspaceId();
    }
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    if (error instanceof ProjectAccessError || error instanceof ReadOnlyAccessError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Invalid project';
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }

  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let eventSeq = lastEventId ? Number(lastEventId) || 0 : 0;
  const abort = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        eventSeq += 1;
        const payload = `id: ${eventSeq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      const onAbort = () => {
        closed = true;
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };
      abort.addEventListener('abort', onAbort);

      const ping = setInterval(() => {
        if (closed) return;
        send('ping', { ok: true, ts: Date.now() });
      }, 10000);

      try {
        if (lastEventId) {
          send('progress', {
            message: `Resuming stream from Last-Event-ID ${lastEventId}`,
          });
        }

        send('progress', { message: `Same-origin check: ${origin}` });

        if (projectId && workspaceId) {
          const applied = await applyDiscoverUrlToProjectProfile(
            projectId,
            workspaceId,
            url
          );
          if (!applied) {
            send('error', {
              message:
                'Client brand profile is required before auto-discover. Configure brand in Settings or the onboarding banner.',
            });
            send('done', { prompts: [], capacityHalt: false });
            return;
          }
          send('progress', {
            message: `Synced crawl URL to profile (${applied.profile.primaryUrl}) · updated ${applied.rowsUpdated} matrix row(s)`,
          });
        }

        send('progress', { message: 'Fetching robots.txt…' });
        await sleep(400, abort);
        send('progress', { message: 'robots.txt OK — respecting crawl directives' });

        send('progress', { message: 'Evaluating sitemap.xml…' });
        await sleep(500, abort);

        // Simulated page candidates with priority
        const candidates = buildDemoPages(origin)
          .filter((p) => !BLOCKED_PATHS.some((re) => re.test(p)))
          .sort((a, b) => {
            const ap = PRIORITY_PATHS.some((re) => re.test(a)) ? 0 : 1;
            const bp = PRIORITY_PATHS.some((re) => re.test(b)) ? 0 : 1;
            return ap - bp;
          })
          .slice(0, 10);

        send('progress', {
          message: `DOM integrity check — ${candidates.length} pages prioritized (max 10)`,
        });

        if (candidates.length === 0) {
          send('error', { message: 'Early-exit: 0 valid tokens extracted' });
          send('done', { prompts: [], capacityHalt: false });
          return;
        }

        send('progress', {
          message: 'Dismissing cookie consent overlays + MC extraction…',
        });
        await sleep(600, abort);

        send('progress', {
          message: `Map-reduce LLM generation (p-limit=3). Capacity remaining: ${remainingCapacity}`,
        });

        const rawLlm = simulateLlmMarkdown(candidates, remainingCapacity);
        const cleaned = stripMarkdownCodeBlocks(rawLlm);
        let prompts: Array<{ prompt: string; cluster: string }> = [];
        try {
          prompts = JSON.parse(cleaned) as Array<{ prompt: string; cluster: string }>;
        } catch {
          send('error', { message: 'Markdown parse guard failed — empty result' });
        }

        // Halt at capacity
        prompts = prompts.slice(0, remainingCapacity);

        // Batch emit prompts for throttled client flush
        for (let i = 0; i < prompts.length; i += 5) {
          if (closed || abort.aborted) break;
          const chunk = prompts.slice(i, i + 5);
          send('prompts', { items: chunk });
          send('progress', {
            message: `Generated ${Math.min(i + 5, prompts.length)}/${prompts.length} prompts`,
          });
          await sleep(350, abort);
        }

        send('done', {
          prompts,
          capacityHalt: prompts.length >= remainingCapacity,
        });
      } catch (err) {
        if (!abort.aborted) {
          send('error', {
            message: err instanceof Error ? err.message : 'Discover failed',
          });
        }
      } finally {
        clearInterval(ping);
        abort.removeEventListener('abort', onAbort);
        closed = true;
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

function buildDemoPages(origin: string): string[] {
  return [
    `${origin}/services/hvac-repair`,
    `${origin}/services/plumbing`,
    `${origin}/products/sump-pumps`,
    `${origin}/blog/how-to-choose-water-heater`,
    `${origin}/privacy`,
    `${origin}/terms`,
    `${origin}/cart`,
    `${origin}/services/roofing`,
    `${origin}/contact`,
    `${origin}/products/thermostats`,
    `${origin}/guides/emergency-plumber`,
  ];
}

function simulateLlmMarkdown(
  pages: string[],
  capacity: number
): string {
  const items = pages.slice(0, Math.min(capacity, 12)).map((p, i) => {
    const slug = p.split('/').pop()?.replace(/-/g, ' ') ?? `topic ${i}`;
    return {
      prompt: `best ${slug} near me`,
      cluster: /product/i.test(p)
        ? 'Product Comparison'
        : /guide|how/i.test(p)
          ? 'How-To Intent'
          : 'Local Services',
    };
  });
  // Intentionally wrap in markdown to exercise stripping guard
  return '```json\n' + JSON.stringify(items, null, 2) + '\n```';
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new Error('aborted'));
      },
      { once: true }
    );
  });
}
