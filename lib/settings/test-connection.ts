import { buildDataForSeoAuthHeader } from '@/lib/rank-tracker/dataforseo';

export type TestConnectionProvider = 'openai' | 'anthropic' | 'gemini' | 'perplexity' | 'dataforseo';

const REQUEST_TIMEOUT_MS = 12_000;

function isPlaceholderSecret(value: string | undefined | null): boolean {
  const trimmed = value?.trim();
  return !trimmed || trimmed === '••••••••';
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function testOpenAiConnection(apiKey: string): Promise<boolean> {
  const response = await fetchWithTimeout('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  return response.ok;
}

export async function testAnthropicConnection(apiKey: string): Promise<boolean> {
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    }),
  });
  return response.ok;
}

export async function testPerplexityConnection(apiKey: string): Promise<boolean> {
  const response = await fetchWithTimeout('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    }),
  });
  return response.ok;
}

export async function testGeminiConnection(apiKey: string): Promise<boolean> {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hi' }] }],
      }),
    }
  );
  return response.ok;
}

export async function testDataForSeoConnection(
  login: string,
  password: string
): Promise<boolean> {
  const response = await fetchWithTimeout('https://api.dataforseo.com/v3/appendix/user_data', {
    method: 'GET',
    headers: {
      Authorization: buildDataForSeoAuthHeader({ login, password }),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return false;
  }

  try {
    const payload = (await response.json()) as { status_code?: number };
    return payload.status_code === 20_000;
  } catch {
    return false;
  }
}

export async function validateProviderConnection(
  provider: TestConnectionProvider,
  credentials: {
    apiKey?: string;
    apiLogin?: string;
    apiPassword?: string;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    switch (provider) {
      case 'openai': {
        if (isPlaceholderSecret(credentials.apiKey)) {
          return { success: false, message: 'OpenAI API key is required.' };
        }
        const ok = await testOpenAiConnection(credentials.apiKey!.trim());
        return ok
          ? { success: true, message: 'Connection successful.' }
          : { success: false, message: 'Invalid API Key' };
      }
      case 'anthropic': {
        if (isPlaceholderSecret(credentials.apiKey)) {
          return { success: false, message: 'Anthropic API key is required.' };
        }
        const ok = await testAnthropicConnection(credentials.apiKey!.trim());
        return ok
          ? { success: true, message: 'Connection successful.' }
          : { success: false, message: 'Invalid API Key' };
      }
      case 'gemini': {
        if (isPlaceholderSecret(credentials.apiKey)) {
          return { success: false, message: 'Google Gemini API key is required.' };
        }
        const ok = await testGeminiConnection(credentials.apiKey!.trim());
        return ok
          ? { success: true, message: 'Connection successful.' }
          : { success: false, message: 'Invalid API Key' };
      }
      case 'perplexity': {
        if (isPlaceholderSecret(credentials.apiKey)) {
          return { success: false, message: 'Perplexity API key is required.' };
        }
        const ok = await testPerplexityConnection(credentials.apiKey!.trim());
        return ok
          ? { success: true, message: 'Connection successful.' }
          : { success: false, message: 'Invalid API Key' };
      }
      case 'dataforseo': {
        if (isPlaceholderSecret(credentials.apiLogin)) {
          return { success: false, message: 'DataForSEO API login is required.' };
        }
        if (isPlaceholderSecret(credentials.apiPassword)) {
          return { success: false, message: 'DataForSEO API password is required.' };
        }
        const ok = await testDataForSeoConnection(
          credentials.apiLogin!.trim(),
          credentials.apiPassword!.trim()
        );
        return ok
          ? { success: true, message: 'Connection successful.' }
          : { success: false, message: 'Invalid API Key' };
      }
      default:
        return { success: false, message: 'Unsupported provider.' };
    }
  } catch {
    return { success: false, message: 'Invalid API Key' };
  }
}

export { isPlaceholderSecret };
