/**
 * Cloudflare Worker — deploy omglaunch manifest webhooks to R2 or KV.
 *
 * Setup:
 * 1. Create a Worker in Cloudflare Dashboard.
 * 2. Add env vars: WEBHOOK_SECRET (optional shared secret).
 * 3. Bind an R2 bucket named MANIFEST_BUCKET, or a KV namespace MANIFEST_KV.
 * 4. Paste this script and deploy.
 * 5. Create a route: https://your-worker.workers.dev/manifest-webhook
 * 6. Add that URL in omglaunch → Settings → Integrations → Webhooks.
 *
 * For production on client domain, map:
 *   client.com/.well-known/domain-profile.json → this worker (read path)
 * and keep the webhook URL on a private workers.dev subdomain.
 */

const MANIFEST_PATH = '/.well-known/domain-profile.json';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve published manifest from storage (public read).
    if (request.method === 'GET' && url.pathname === MANIFEST_PATH) {
      return serveManifest(env);
    }

    // Receive omglaunch webhook (POST).
    if (request.method === 'POST' && url.pathname.endsWith('/manifest-webhook')) {
      return handleWebhook(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleWebhook(request, env) {
  if (env.WEBHOOK_SECRET) {
    const token = request.headers.get('x-webhook-secret');
    if (token !== env.WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const event = request.headers.get('x-omg-launch-event');
  if (event !== 'manifest.published' && event !== 'manifest.test') {
    return new Response('Unsupported event', { status: 400 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!payload?.manifest) {
    return new Response('Missing manifest', { status: 400 });
  }

  const body = JSON.stringify(payload.manifest, null, 2);
  const projectId = payload.projectId ?? 'default';
  const key = `manifests/${projectId}/domain-profile.json`;

  // Option A: R2 bucket
  if (env.MANIFEST_BUCKET) {
    await env.MANIFEST_BUCKET.put(key, body, {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
    });
  }

  // Option B: KV (single-tenant — one manifest per worker)
  if (env.MANIFEST_KV) {
    await env.MANIFEST_KV.put('domain-profile', body);
  }

  return Response.json({
    ok: true,
    event,
    projectId,
    version: payload.version ?? null,
    storedAt: new Date().toISOString(),
  });
}

async function serveManifest(env) {
  let body = null;

  if (env.MANIFEST_KV) {
    body = await env.MANIFEST_KV.get('domain-profile');
  }

  if (!body && env.MANIFEST_BUCKET) {
    const object = await env.MANIFEST_BUCKET.get('manifests/default/domain-profile.json');
    body = object ? await object.text() : null;
  }

  if (!body) {
    return new Response('Manifest not found', { status: 404 });
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
