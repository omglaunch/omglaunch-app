# Manifest webhook deploy recipes

When you **Publish to client domain** in omglaunch, the app POSTs the published JSON to every URL in **Settings → Integrations → Webhooks**.

Use these recipes to write that JSON to the client site at:

`https://{client-domain}/.well-known/domain-profile.json`

---

## Webhook payload

### Live publish (`manifest.published`)

```json
{
  "event": "manifest.published",
  "projectId": "clx…",
  "projectName": "Decathlon Malaysia",
  "projectDomain": "www.decathlon.my",
  "version": 5,
  "publishedAt": "2026-07-27T03:00:00.000Z",
  "productionUrl": "https://www.decathlon.my/.well-known/domain-profile.json",
  "manifestUrl": "https://www.decathlon.my/.well-known/domain-profile.json",
  "manifest": { }
}
```

### Test ping (`manifest.test`)

Sent when you click **Test** next to a webhook URL in Integrations. Same shape, with `"event": "manifest.test"` and `"test": true`. Sample manifest uses `example.com`.

### Headers

| Header | Value |
|--------|--------|
| `Content-Type` | `application/json` |
| `X-OMG-Launch-Event` | `manifest.published` or `manifest.test` |
| `X-OMG-Launch-Project-Id` | Project ID |
| `User-Agent` | `omglaunch-manifest-webhook/1.0` |

**Tip:** Ignore `manifest.test` events in production deploy steps, or route them to a staging bucket.

---

## Zapier recipe

**Goal:** Write `manifest` to static hosting (S3, Netlify, or FTP).

1. **Trigger:** Webhooks by Zapier → Catch Hook.
2. Copy the hook URL into omglaunch → Settings → Integrations → Webhooks.
3. Click **Test** in omglaunch to send a sample payload.
4. In Zapier, add a **Filter** step:
   - Only continue if `event` exactly matches `manifest.published` (skip tests).
5. Add your deploy action, for example:

### S3 upload

- **App:** Amazon S3 → Upload File
- **File:** Map field `manifest` → use a **Code by Zapier** step first:

```javascript
const manifest = inputData.manifest;
return {
  filename: 'domain-profile.json',
  content: JSON.stringify(manifest, null, 2),
  contentType: 'application/json',
};
```

- **Key:** `.well-known/domain-profile.json`
- **ACL:** public-read (or use CloudFront in front of the bucket).

### Netlify deploy hook (rebuild site)

If the manifest lives in your repo:

1. Code step writes JSON to a temp file or GitHub commit (advanced).
2. Or use Netlify **Deploy Hook** after an S3 sync step.

Simpler path: store JSON in S3/Cloudflare R2 and point `/.well-known/` via CDN rewrite (see Cloudflare Worker below).

---

## Make (Integromat) recipe

1. **Module:** Webhooks → Custom webhook.
2. Paste URL into omglaunch Integrations.
3. **Router** on `event`:
   - Route A: `manifest.published` → deploy
   - Route B: `manifest.test` → optional Slack “test OK”
4. **HTTP / AWS S3 / Google Cloud Storage** module:
   - Body: `{{json manifest}}` formatted as pretty JSON
   - Path: `.well-known/domain-profile.json`

---

## Cloudflare Worker (recommended for agencies)

Full example: [`docs/examples/cloudflare-worker-manifest-deploy.js`](../examples/cloudflare-worker-manifest-deploy.js)

### Quick setup

1. Create a Worker + bind **R2** (`MANIFEST_BUCKET`) or **KV** (`MANIFEST_KV`).
2. Deploy the example script.
3. Webhook URL: `https://your-worker.workers.dev/manifest-webhook`
4. Optional: set `WEBHOOK_SECRET` and send header `X-Webhook-Secret` from a Zapier Code step (Worker checks it).
5. Map client domain path to the Worker:

```
client.com/.well-known/domain-profile.json  →  Worker GET handler
```

6. Publish in omglaunch → Worker stores JSON → GET serves it on the client domain.

### Multi-client (one worker, many projects)

The example stores by `projectId`:

```
manifests/{projectId}/domain-profile.json
```

Use `Host` header or a path prefix per client in the GET handler, or one Worker per client.

---

## Verify deploy

1. **omglaunch:** Settings → Domain Manifest → **Production health check**
2. **Manual:** Open `https://{client-domain}/.well-known/domain-profile.json`
3. Compare `name`, `website`, and `entity_type` with the published manifest in omglaunch.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Test OK, publish fails | Filter out only `manifest.test`; check Zapier task history for publish event |
| HTTP 403 from webhook | Allow POST from omglaunch IP or use Zapier/Make (no IP allowlist) |
| Stale file on CDN | Purge cache for `/.well-known/domain-profile.json` after upload |
| No webhooks fired | Add URL in Settings → Integrations; publish again from Domain Manifest |

---

## Security notes

- Webhook URLs are workspace-wide. Use Zapier/Make routing on `projectId` for multi-client workspaces.
- Do not commit webhook secrets to git. Use env vars in Workers (`WEBHOOK_SECRET`).
- omglaunch blocks private-network URLs in production (SSRF guard).
