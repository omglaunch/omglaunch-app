import { getPrisma } from '@/lib/prisma';
import { tryDecryptSecret, getOrCreateSystemConfiguration } from '@/lib/admin/system-config';

export type LlmProvider = 'openai' | 'anthropic' | 'gemini' | 'perplexity';

export type ResolvedCredential = {
  apiKey: string;
  source: 'workspace' | 'master';
  usesCredits: boolean;
};

async function getMasterKey(provider: LlmProvider): Promise<string | null> {
  const config = await getOrCreateSystemConfiguration();

  const encryptedMap: Record<LlmProvider, string | null | undefined> = {
    openai: config.masterOpenaiKey,
    anthropic: config.masterAnthropicKey,
    gemini: config.masterGeminiKey,
    perplexity: process.env.MASTER_PERPLEXITY_KEY ?? null,
  };

  const encrypted = encryptedMap[provider];
  if (encrypted?.trim()) {
    const decrypted = tryDecryptSecret(encrypted);
    if (decrypted) return decrypted;
  }

  const envMap: Record<LlmProvider, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY,
  };
  return envMap[provider]?.trim() ?? null;
}

/**
 * Resolves LLM credentials: workspace BYOK first, then master env keys.
 * When master keys are used, credits should be deducted.
 */
export async function resolveLlmCredential(
  workspaceId: string,
  provider: LlmProvider
): Promise<ResolvedCredential | null> {
  const prisma = getPrisma();
  const [aiConfig, user] = await Promise.all([
    prisma.aiConfig.findFirst({ where: { workspaceId } }),
    prisma.user.findUnique({ where: { id: workspaceId }, select: { byokEnabled: true } }),
  ]);

  const workspaceKeyMap: Record<LlmProvider, string | null | undefined> = {
    openai: aiConfig?.openaiApiKey,
    anthropic: aiConfig?.anthropicApiKey,
    gemini: aiConfig?.geminiApiKey,
    perplexity: aiConfig?.perplexityApiKey,
  };

  const workspaceKey = workspaceKeyMap[provider]?.trim();
  if (workspaceKey && user?.byokEnabled !== false) {
    return { apiKey: workspaceKey, source: 'workspace', usesCredits: false };
  }

  const masterKey = await getMasterKey(provider);
  if (masterKey) {
    return { apiKey: masterKey, source: 'master', usesCredits: true };
  }

  return null;
}
