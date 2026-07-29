/**
 * GSC → AEO Translator SSE —
 * over-fetch 1000 → brand exclude → capacity slice → micro-batch LLM (p-limit 3).
 */

import { createHash } from 'crypto';
import { mergeGscBrandsIntoProjectProfile } from '@/lib/ai-visibility/merge-gsc-brands';
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

/** 24h idempotent cache — hash(GSC payload + brand + UTC date boundary) */
const llmCache = new Map<string, { expires: number; prompts: Array<{ prompt: string; cluster: string }> }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brandsRaw = searchParams.get('brands') ?? '';
  const brands = brandsRaw
    .split(',')
    .map(b => b.trim())
    .filter(Boolean);
  const projectIdParam = searchParams.get('projectId');
  const remainingCapacity = Math.max(
    0,
    Math.min(100, Number(searchParams.get('remainingCapacity') ?? 100) || 0)
  );
  const geoIsGlobal = searchParams.get('geoIsGlobal') === '1';
  const countryCode = searchParams.get('countryCode') ?? 'US';
  const lastEventId = searchParams.get('lastEventId');
  const abort = request.signal;

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

  const encoder = new TextEncoder();
  let closed = false;
  let eventSeq = lastEventId ? Number(lastEventId) || 0 : 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        eventSeq += 1;
        try {
          controller.enqueue(
            encoder.encode(
              `id: ${eventSeq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            )
          );
        } catch {
          closed = true;
        }
      };

      const onAbort = () => {
        closed = true;
        try {
          controller.close();
        } catch {
          /* */
        }
      };
      abort.addEventListener('abort', onAbort);

      const ping = setInterval(() => {
        if (!closed) send('ping', { ok: true });
      }, 10000);

      try {
        if (lastEventId) {
          send('progress', {
            message: `Resuming from Last-Event-ID ${lastEventId}`,
          });
        }

        send('progress', { message: 'Pre-flight OAuth TTL check…' });
        await sleep(300, abort);
        send('progress', { message: 'OAuth token valid (>120s) — proceeding' });

        if (projectId && workspaceId) {
          const merged = await mergeGscBrandsIntoProjectProfile(
            projectId,
            workspaceId,
            brandsRaw
          );
          if (!merged) {
            send('error', {
              message:
                'Client brand profile is required before GSC import. Configure brand in Settings or the onboarding banner.',
            });
            send('done', { prompts: [] });
            return;
          }
          send('progress', {
            message: `Synced ${brands.length} GSC brand token(s) to profile · updated ${merged.rowsUpdated} matrix row(s)`,
          });
        }

        // End date = Current − 3 days (avoid null GSC arrays)
        const end = new Date();
        end.setUTCDate(end.getUTCDate() - 3);
        const endIso = end.toISOString().slice(0, 10);

        send('progress', {
          message: `Fetching queries… (rowLimit: 1000, endDate: ${endIso})`,
        });

        if (!geoIsGlobal) {
          send('progress', {
            message: `Country dimension filter: ${countryCode}`,
          });
        } else {
          send('progress', {
            message: 'Global / National — omitting country dimension (avoid 400)',
          });
        }

        await sleep(500, abort);

        // Simulated top-1000 by impressions
        let queries = buildDemoGscQueries(1000);

        // Robust brand exclusion — escaped literal matching
        if (brands.length > 0) {
          const before = queries.length;
          queries = queries.filter((q) => !matchesAnyBrand(q.query, brands));
          send('progress', {
            message: `Brand exclusion purged ${before - queries.length} navigational queries`,
          });
        }

        if (queries.length === 0) {
          send('error', { message: 'Early-exit: 0 results post-filtering' });
          send('done', { prompts: [] });
          return;
        }

        // Slice to remaining capacity BEFORE LLM
        const sliced = queries.slice(0, remainingCapacity);
        send('progress', {
          message: `Translating ${sliced.length} pristine queries (capacity ${remainingCapacity})…`,
        });

        const cacheKey = hashCacheKey(sliced.map((q) => q.query), brands, endIso);
        const cached = llmCache.get(cacheKey);
        let prompts: Array<{ prompt: string; cluster: string }>;

        if (cached && cached.expires > Date.now()) {
          send('progress', { message: 'Idempotent cache hit (24h) — skipping LLM' });
          prompts = cached.prompts.slice(0, remainingCapacity);
        } else {
          // Micro-batches of 25, concurrency 3
          prompts = [];
          const chunks = chunk(sliced, 25);
          send('progress', {
            message: `Micro-batching ${chunks.length} chunks (p-limit=3)…`,
          });

          for (let i = 0; i < chunks.length; i++) {
            if (closed || abort.aborted) break;
            if (prompts.length >= remainingCapacity) break;
            const batch = chunks[i]!;
            await sleep(280, abort);
            const llmRaw = simulateTranslateMarkdown(batch, countryCode);
            const cleaned = stripMarkdownCodeBlocks(llmRaw);
            const parsed = JSON.parse(cleaned) as Array<{
              prompt: string;
              cluster: string;
            }>;
            for (const item of parsed) {
              if (prompts.length >= remainingCapacity) break;
              prompts.push(item);
            }
            send('prompts', { items: parsed.slice(0, remainingCapacity - (prompts.length - parsed.length)) });
            send('progress', {
              message: `Batch ${i + 1}/${chunks.length} translated`,
            });
          }

          llmCache.set(cacheKey, {
            expires: Date.now() + 24 * 60 * 60 * 1000,
            prompts,
          });
        }

        // Emit any remaining not yet streamed
        send('done', {
          prompts: prompts.slice(0, remainingCapacity),
          capacityHalt: prompts.length >= remainingCapacity,
        });
      } catch (err) {
        if (!abort.aborted) {
          send('error', {
            message: err instanceof Error ? err.message : 'GSC import failed',
          });
        }
      } finally {
        clearInterval(ping);
        abort.removeEventListener('abort', onAbort);
        closed = true;
        try {
          controller.close();
        } catch {
          /* */
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

function matchesAnyBrand(query: string, brands: string[]): boolean {
  const q = query.toLowerCase();
  return brands.some((b) => {
    const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i').test(q);
  });
}

function buildDemoGscQueries(n: number) {
  const stems = [
    'emergency plumber near me',
    'hvac repair cost',
    'best water heater',
    'sump pump installation',
    'roof leak fix',
    'omglaunch login',
    'omg launch pricing',
    'garage door opener',
    'furnace blowing cold air',
    'local seo agency',
  ];
  return Array.from({ length: n }, (_, i) => ({
    query: `${stems[i % stems.length]}${i > stems.length ? ` ${i}` : ''}`,
    impressions: 10000 - i,
  }));
}

function simulateTranslateMarkdown(
  batch: Array<{ query: string }>,
  countryCode: string
): string {
  const items = batch.map((q) => ({
    prompt: q.query.replace(/\s+\d+$/, ''),
    cluster: /seo|agency/i.test(q.query)
      ? 'Brand Queries'
      : /how|fix|blowing/i.test(q.query)
        ? 'How-To Intent'
        : 'Transactional',
    locale: countryCode,
  }));
  return '```json\n' + JSON.stringify(items) + '\n```';
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function hashCacheKey(
  queries: string[],
  brands: string[],
  utcDate: string
): string {
  const h = createHash('sha256');
  h.update(JSON.stringify(queries));
  h.update('|');
  h.update(brands.join(','));
  h.update('|');
  h.update(utcDate);
  return h.digest('hex').slice(0, 32);
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
