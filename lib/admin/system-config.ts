import { prisma } from '@/lib/prisma';
import { decryptSecret, encryptSecret } from '@/lib/admin/encryption';

const SECRET_FIELDS = [
  'masterOpenaiKey',
  'masterAnthropicKey',
  'masterGeminiKey',
  'masterDataForSeoLogin',
  'masterDataForSeoPassword',
] as const;

export async function getOrCreateSystemConfiguration() {
  let config = await prisma.systemConfiguration.findUnique({
    where: { id: 'singleton' },
  });

  if (!config) {
    config = await prisma.systemConfiguration.create({
      data: { id: 'singleton' },
    });
  }

  return config;
}

export function maskSystemConfigSecrets(
  config: Awaited<ReturnType<typeof getOrCreateSystemConfiguration>>
) {
  return {
    ...config,
    masterOpenaiKey: config.masterOpenaiKey ? '••••••••' : null,
    masterAnthropicKey: config.masterAnthropicKey ? '••••••••' : null,
    masterGeminiKey: config.masterGeminiKey ? '••••••••' : null,
    masterDataForSeoLogin: config.masterDataForSeoLogin ? '••••••••' : null,
    masterDataForSeoPassword: config.masterDataForSeoPassword ? '••••••••' : null,
  };
}

export function resolveEncryptedSecretUpdate(
  incoming: string | undefined,
  existing: string | null | undefined
): string | null | undefined {
  if (incoming === undefined) return undefined;
  const trimmed = incoming.trim();
  if (!trimmed || trimmed === '••••••••') {
    return existing ?? null;
  }
  return encryptSecret(trimmed);
}

export async function updateSystemConfiguration(
  data: Record<string, unknown>
) {
  const existing = await getOrCreateSystemConfiguration();
  const updateData: Record<string, unknown> = { ...data };

  for (const field of SECRET_FIELDS) {
    if (field in updateData) {
      const resolved = resolveEncryptedSecretUpdate(
        updateData[field] as string | undefined,
        existing[field]
      );
      if (resolved !== undefined) {
        updateData[field] = resolved;
      } else {
        delete updateData[field];
      }
    }
  }

  return prisma.systemConfiguration.update({
    where: { id: 'singleton' },
    data: updateData,
  });
}

export function tryDecryptSecret(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch {
    return null;
  }
}
