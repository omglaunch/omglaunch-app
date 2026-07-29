import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { runWithAuthenticatedTenantScope, requireWorkspaceId } from '@/lib/projects/tenant-scope';
import {
  isPlaceholderSecret,
  validateProviderConnection,
  type TestConnectionProvider,
} from '@/lib/settings/test-connection';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type TestConnectionBody = {
  provider?: TestConnectionProvider;
  apiKey?: string;
  apiLogin?: string;
  apiPassword?: string;
  useSaved?: boolean;
};

const PROVIDERS: TestConnectionProvider[] = ['openai', 'anthropic', 'gemini', 'perplexity', 'dataforseo'];

async function resolveSavedCredentials(
  provider: TestConnectionProvider,
  workspaceId: string
): Promise<{ apiKey?: string; apiLogin?: string; apiPassword?: string } | null> {
  if (provider === 'dataforseo') {
    const config = await getPrisma().integrationConfig.findFirst({
      where: { workspaceId },
      select: { dataForSeoLogin: true, dataForSeoPassword: true },
    });
    if (!config?.dataForSeoLogin?.trim() || !config.dataForSeoPassword?.trim()) {
      return null;
    }
    return {
      apiLogin: config.dataForSeoLogin,
      apiPassword: config.dataForSeoPassword,
    };
  }

  const ai = await getPrisma().aiConfig.findFirst({
    where: { workspaceId },
    select: { openaiApiKey: true, anthropicApiKey: true, geminiApiKey: true, perplexityApiKey: true },
  });
  if (!ai) return null;

  const keyMap = {
    openai: ai.openaiApiKey,
    anthropic: ai.anthropicApiKey,
    gemini: ai.geminiApiKey,
    perplexity: ai.perplexityApiKey,
  } as const;

  const apiKey = keyMap[provider];
  if (!apiKey?.trim()) return null;
  return { apiKey };
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as TestConnectionBody;
    const provider = body.provider;

    if (!provider || !PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { success: false, message: 'Invalid provider.' },
        { status: 400 }
      );
    }

    return await runWithAuthenticatedTenantScope(async () => {
      const workspaceId = await requireWorkspaceId();

      let apiKey = body.apiKey;
      let apiLogin = body.apiLogin;
      let apiPassword = body.apiPassword;

      const needsSavedKey =
        body.useSaved ||
        (provider === 'dataforseo'
          ? isPlaceholderSecret(apiPassword)
          : isPlaceholderSecret(apiKey));

      if (needsSavedKey) {
        const saved = await resolveSavedCredentials(provider, workspaceId);
        if (!saved) {
          return NextResponse.json({
            success: false,
            message: 'Invalid API Key',
          });
        }
        if (provider === 'dataforseo') {
          apiLogin = isPlaceholderSecret(apiLogin) ? saved.apiLogin : apiLogin;
          apiPassword = isPlaceholderSecret(apiPassword) ? saved.apiPassword : apiPassword;
        } else {
          apiKey = isPlaceholderSecret(apiKey) ? saved.apiKey : apiKey;
        }
      }

      const result = await validateProviderConnection(provider, {
        apiKey,
        apiLogin,
        apiPassword,
      });

      return NextResponse.json(result);
    });
  } catch (error) {
    console.error('[settings/test-connection] POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Invalid API Key' },
      { status: 500 }
    );
  }
}
