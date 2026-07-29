import { readFileSync } from 'node:fs';
import path from 'node:path';
import ManifestWebhookGuideClient from './ManifestWebhookGuideClient';

export const dynamic = 'force-dynamic';

function loadGuideMarkdown(): string {
  const filePath = path.join(process.cwd(), 'docs/integrations/manifest-webhook-deploy.md');
  return readFileSync(filePath, 'utf8');
}

export default function ManifestWebhookGuidePage() {
  return <ManifestWebhookGuideClient content={loadGuideMarkdown()} />;
}
