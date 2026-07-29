export type TestManifestWebhookResponse = {
  success: boolean;
  message?: string;
  statusCode?: number;
};

export async function testManifestWebhook(url: string): Promise<TestManifestWebhookResponse> {
  const response = await fetch('/api/settings/test-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const data = (await response.json()) as TestManifestWebhookResponse;

  if (response.status === 401) {
    return { success: false, message: 'Unauthorized' };
  }

  return data;
}
