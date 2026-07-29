import type { TestConnectionProvider } from '@/lib/settings/test-connection';

export type TestConnectionRequest = {
  provider: TestConnectionProvider;
  apiKey?: string;
  apiLogin?: string;
  apiPassword?: string;
  useSaved?: boolean;
};

export type TestConnectionResponse = {
  success: boolean;
  message?: string;
};

export async function testSettingsConnection(
  payload: TestConnectionRequest
): Promise<TestConnectionResponse> {
  const response = await fetch('/api/settings/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TestConnectionResponse;

  if (response.status === 401) {
    return { success: false, message: 'Unauthorized' };
  }

  return data;
}

export const TEST_CONNECTION_SUCCESS_MESSAGE =
  'Connection successful! Your API key is valid.';
export const TEST_CONNECTION_FAILURE_MESSAGE =
  'Connection failed. Please double-check your credentials.';
