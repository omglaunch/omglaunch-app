import pLimit from 'p-limit';
import { GoogleGenAI } from '@google/genai';
import type { GridCell, PerplexityRecommendation, SpamRadarEntry } from './types';
import { GEMINI_SPAM_MODEL, OPENAI_CONCURRENCY_LIMIT, OPENAI_MICRO_GRID_MODEL, PERPLEXITY_MODEL } from './constants';
import { resolveLlmCredential } from '@/lib/llm/credentials';

export async function runMicroGridVisibility(
  workspaceId: string,
  keyword: string,
  cells: GridCell[],
  businessName?: string
): Promise<GridCell[]> {
  const credential = await resolveLlmCredential(workspaceId, 'openai');
  if (!credential) {
    return cells.map(c => ({ ...c, aiVisible: null }));
  }

  const limit = pLimit(OPENAI_CONCURRENCY_LIMIT);

  const updated = await Promise.all(
    cells.map(cell =>
      limit(async () => {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${credential.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: OPENAI_MICRO_GRID_MODEL,
              max_tokens: 50,
              temperature: 0,
              messages: [
                {
                  role: 'system',
                  content:
                    'You assess local business AI/search visibility. Reply ONLY with JSON: {"visible": true|false}',
                },
                {
                  role: 'user',
                  content: `Would "${businessName ?? 'the target business'}" appear in AI/local recommendations for "${keyword}" near coordinates ${cell.lat},${cell.lng}? Consider local pack and AI assistant visibility.`,
                },
              ],
            }),
          });

          if (!response.ok) return { ...cell, aiVisible: null };

          const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = data.choices?.[0]?.message?.content ?? '';
          const match = content.match(/\{[\s\S]*\}/);
          if (!match) return { ...cell, aiVisible: null };

          const parsed = JSON.parse(match[0]) as { visible?: boolean };
          return { ...cell, aiVisible: Boolean(parsed.visible) };
        } catch {
          return { ...cell, aiVisible: null };
        }
      })
    )
  );

  return updated;
}

export async function runPerplexityMacroScorecard(
  workspaceId: string,
  keyword: string,
  location: string
): Promise<PerplexityRecommendation[]> {
  const credential = await resolveLlmCredential(workspaceId, 'perplexity');
  if (!credential) return [];

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `For the local search keyword "${keyword}" in ${location}, list the top 5 live-web recommendations for local service providers. Return JSON array: [{"rank":1,"title":"...","summary":"...","source":"..."}]`,
          },
        ],
      }),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];

    return JSON.parse(match[0]) as PerplexityRecommendation[];
  } catch {
    return [];
  }
}

export async function runGeminiSpamRadar(
  workspaceId: string,
  competitorNames: string[],
  keyword: string
): Promise<SpamRadarEntry[]> {
  if (competitorNames.length === 0) return [];

  const credential = await resolveLlmCredential(workspaceId, 'gemini');
  if (!credential) return [];

  try {
    const ai = new GoogleGenAI({ apiKey: credential.apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_SPAM_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze these Google Business Profile names for keyword stuffing related to "${keyword}": ${competitorNames.join(', ')}. Return JSON array: [{"businessName":"...","cid":null,"reason":"...","severity":"low"|"medium"|"high"}]. Only flag blatant keyword stuffing.`,
            },
          ],
        },
      ],
    });

    const text = response.text ?? '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    return JSON.parse(match[0]) as SpamRadarEntry[];
  } catch {
    return [];
  }
}

export async function generateReviewReply(
  workspaceId: string,
  reviewText: string,
  rating: number,
  brandVoice: string,
  model: string
): Promise<string> {
  if (model.startsWith('claude')) {
    const credential = await resolveLlmCredential(workspaceId, 'anthropic');
    if (!credential) throw new Error('Anthropic API key not configured');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': credential.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `Write a professional Google review reply. Brand voice: ${brandVoice}. Rating: ${rating}/5. Review: "${reviewText}". Keep it concise and authentic.`,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error('Failed to generate review reply');
    const data = (await response.json()) as {
      content?: Array<{ text?: string }>;
    };
    return data.content?.[0]?.text ?? '';
  }

  const provider = model.startsWith('gpt') ? 'openai' : 'gemini';
  const credential = await resolveLlmCredential(workspaceId, provider);
  if (!credential) throw new Error(`${provider} API key not configured`);

  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `Write a professional Google review reply. Brand voice: ${brandVoice}. Rating: ${rating}/5. Review: "${reviewText}". Keep it concise.`,
          },
        ],
      }),
    });
    if (!response.ok) throw new Error('Failed to generate review reply');
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? '';
  }

  const ai = new GoogleGenAI({ apiKey: credential.apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_SPAM_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Write a professional Google review reply. Brand voice: ${brandVoice}. Rating: ${rating}/5. Review: "${reviewText}". Keep it concise.`,
          },
        ],
      },
    ],
  });
  return response.text ?? '';
}

export async function generateServiceAreaPage(
  workspaceId: string,
  coreService: string,
  targetCity: string,
  model: string,
  brandVoice: string
): Promise<{ html: string; jsonLd: Record<string, unknown> }> {
  const provider = model.startsWith('claude')
    ? 'anthropic'
    : model.startsWith('gpt')
      ? 'openai'
      : 'gemini';

  const prompt = `Generate a geo-targeted service page for "${coreService}" in "${targetCity}". Brand voice: ${brandVoice}. Return JSON: {"html":"<article>...</article>","jsonLd":{...LocalBusiness schema...}}. HTML must NOT contain script tags. JSON-LD must be separate.`;

  if (provider === 'anthropic') {
    const credential = await resolveLlmCredential(workspaceId, 'anthropic');
    if (!credential) throw new Error('Anthropic API key not configured');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': credential.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) throw new Error('Failed to generate service page');
    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const match = (data.content?.[0]?.text ?? '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Invalid LLM response');
    return JSON.parse(match[0]) as { html: string; jsonLd: Record<string, unknown> };
  }

  if (provider === 'openai') {
    const credential = await resolveLlmCredential(workspaceId, 'openai');
    if (!credential) throw new Error('OpenAI API key not configured');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) throw new Error('Failed to generate service page');
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const match = (data.choices?.[0]?.message?.content ?? '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Invalid LLM response');
    return JSON.parse(match[0]) as { html: string; jsonLd: Record<string, unknown> };
  }

  const credential = await resolveLlmCredential(workspaceId, 'gemini');
  if (!credential) throw new Error('Gemini API key not configured');

  const ai = new GoogleGenAI({ apiKey: credential.apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_SPAM_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  const match = (response.text ?? '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Invalid LLM response');
  return JSON.parse(match[0]) as { html: string; jsonLd: Record<string, unknown> };
}

export async function auditNapConsistency(
  workspaceId: string,
  brandName: string,
  address: string,
  phone: string,
  citations: Array<{ url: string; title: string; snippet: string }>,
  model: string
): Promise<Array<{ source: string; url: string; napMatch: 'consistent' | 'inconsistent' | 'partial'; details: string }>> {
  const credential = await resolveLlmCredential(
    workspaceId,
    model.startsWith('claude') ? 'anthropic' : model.startsWith('gpt') ? 'openai' : 'gemini'
  );
  if (!credential) return [];

  const prompt = `Official NAP: Name="${brandName}", Address="${address}", Phone="${phone}". Analyze these citations for NAP consistency. Return JSON array: [{"source":"...","url":"...","napMatch":"consistent"|"inconsistent"|"partial","details":"..."}]. Citations: ${JSON.stringify(citations.slice(0, 15))}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const match = (data.choices?.[0]?.message?.content ?? '').match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as Array<{
      source: string;
      url: string;
      napMatch: 'consistent' | 'inconsistent' | 'partial';
      details: string;
    }>;
  } catch {
    return [];
  }
}
