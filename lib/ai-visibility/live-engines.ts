/**
 * Live AI Visibility engine adapters (API-backed).
 * Google AIO scrape path remains deferred — not called from here.
 */

import { withTwoAttemptRetry } from '@/lib/ai-visibility/adapters';
import {
  AI_VISIBILITY_ANTHROPIC_MODEL,
  AI_VISIBILITY_OPENAI_MODEL,
  AI_VISIBILITY_PERPLEXITY_MODEL,
  type LiveForceSyncEngine,
} from '@/lib/ai-visibility/constants';
import { extractUrls } from '@/lib/ai-visibility/citation-mappers';
import {
  resolveLlmCredential,
  type ResolvedCredential,
} from '@/lib/llm/credentials';

export type LiveEngineQueryResult =
  | {
      ok: true;
      engine: LiveForceSyncEngine;
      answer: string;
      urls: string[];
      credential: ResolvedCredential;
    }
  | {
      ok: false;
      engine: LiveForceSyncEngine;
      reason: 'missing_key' | 'api_error' | 'timeout';
      detail?: string;
      credential: ResolvedCredential | null;
    };

function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  );
}

function visibilitySystemPrompt(): string {
  return [
    'You are answering a consumer/local research query for AI visibility measurement.',
    'Respond with helpful recommendations. Prefer real brand/site names and include https links when you cite sources.',
    'Reply with JSON only (no markdown fences):',
    '{"answer":"<short markdown answer with optional links>","urls":["https://..."],"competitors":["Name"]}',
  ].join(' ');
}

function visibilityUserPrompt(prompt: string, geoTarget: string): string {
  return `Query: "${prompt}"\nGeo context: ${geoTarget || 'unspecified'}\nReturn the JSON object now.`;
}

function parseJsonPayload(content: string): {
  answer: string;
  urls: string[];
} {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    return { answer: content.trim(), urls: extractUrls(content) };
  }
  try {
    const parsed = JSON.parse(match[0]) as {
      answer?: string;
      urls?: unknown;
    };
    const answer =
      typeof parsed.answer === 'string' && parsed.answer.trim()
        ? parsed.answer
        : content.trim();
    const fromJson = Array.isArray(parsed.urls)
      ? parsed.urls.filter((u): u is string => typeof u === 'string')
      : [];
    const urls = Array.from(new Set([...fromJson, ...extractUrls(answer)]));
    return { answer, urls };
  } catch {
    return { answer: content.trim(), urls: extractUrls(content) };
  }
}

async function fetchOpenAiAnswer(
  apiKey: string,
  prompt: string,
  geoTarget: string
): Promise<{ answer: string; urls: string[] }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_VISIBILITY_OPENAI_MODEL,
      max_tokens: 700,
      temperature: 0.2,
      messages: [
        { role: 'system', content: visibilitySystemPrompt() },
        { role: 'user', content: visibilityUserPrompt(prompt, geoTarget) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return parseJsonPayload(data.choices?.[0]?.message?.content ?? '');
}

async function fetchAnthropicAnswer(
  apiKey: string,
  prompt: string,
  geoTarget: string
): Promise<{ answer: string; urls: string[] }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_VISIBILITY_ANTHROPIC_MODEL,
      max_tokens: 700,
      temperature: 0.2,
      system: visibilitySystemPrompt(),
      messages: [
        { role: 'user', content: visibilityUserPrompt(prompt, geoTarget) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Anthropic ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ text?: string }>;
  };
  return parseJsonPayload(data.content?.[0]?.text ?? '');
}

async function fetchPerplexityAnswer(
  apiKey: string,
  prompt: string,
  geoTarget: string
): Promise<{ answer: string; urls: string[] }> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_VISIBILITY_PERPLEXITY_MODEL,
      max_tokens: 700,
      temperature: 0.2,
      messages: [
        { role: 'system', content: visibilitySystemPrompt() },
        { role: 'user', content: visibilityUserPrompt(prompt, geoTarget) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Perplexity ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: unknown;
  };
  const parsed = parseJsonPayload(data.choices?.[0]?.message?.content ?? '');
  const citationUrls = Array.isArray(data.citations)
    ? data.citations.filter((u): u is string => typeof u === 'string')
    : [];
  return {
    answer: parsed.answer,
    urls: Array.from(new Set([...citationUrls, ...parsed.urls])),
  };
}

export async function queryLiveEngine(
  workspaceId: string,
  engine: LiveForceSyncEngine,
  prompt: string,
  geoTarget: string
): Promise<LiveEngineQueryResult> {
  const provider =
    engine === 'chatgpt'
      ? 'openai'
      : engine === 'claude'
        ? 'anthropic'
        : 'perplexity';

  const credential = await resolveLlmCredential(workspaceId, provider);
  if (!credential) {
    return { ok: false, engine, reason: 'missing_key', credential: null };
  }

  try {
    const payload = await withTwoAttemptRetry(async () => {
      if (engine === 'chatgpt') {
        return fetchOpenAiAnswer(credential.apiKey, prompt, geoTarget);
      }
      if (engine === 'claude') {
        return fetchAnthropicAnswer(credential.apiKey, prompt, geoTarget);
      }
      return fetchPerplexityAnswer(credential.apiKey, prompt, geoTarget);
    }, isTimeoutError);

    return {
      ok: true,
      engine,
      answer: payload.answer,
      urls: payload.urls,
      credential,
    };
  } catch (err) {
    const reason = isTimeoutError(err) ? 'timeout' : 'api_error';
    console.error(`[ai-visibility] ${engine} live query failed:`, err);
    return {
      ok: false,
      engine,
      reason,
      detail: err instanceof Error ? err.message : String(err),
      credential,
    };
  }
}
