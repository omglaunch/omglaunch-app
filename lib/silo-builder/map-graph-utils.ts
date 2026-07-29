export const SILO_MAP_BRAND_BLUE = '#2563eb';
export const SILO_MAP_LATERAL_SLATE = '#94a3b8';

export function normalizeSiloNodeTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function truncateSiloMapLabel(text: string, maxLength = 22): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}…`;
}
