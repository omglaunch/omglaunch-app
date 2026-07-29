export function maskSecret(value: string | null | undefined): {
  masked: string | null;
  isSet: boolean;
} {
  if (!value?.trim()) {
    return { masked: null, isSet: false };
  }
  return { masked: '••••••••', isSet: true };
}

export function resolveSecretUpdate(
  incoming: string | undefined,
  existing: string | null | undefined
): string | null | undefined {
  if (incoming === undefined) {
    return undefined;
  }
  const trimmed = incoming.trim();
  if (!trimmed || trimmed === '••••••••') {
    return existing ?? null;
  }
  return trimmed;
}
