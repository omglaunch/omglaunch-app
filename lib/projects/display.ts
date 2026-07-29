import type { KeywordManagerProject } from '@/app/actions/keyword-manager';
import { getResearchLocationLabel } from '@/app/(dashboard)/research/research-locations';

export function locationCodeAbbreviation(code: number | null | undefined): string | null {
  if (code == null || !Number.isFinite(code)) {
    return null;
  }

  const label = getResearchLocationLabel(code);
  const normalized = label.trim().toLowerCase();

  if (normalized.includes('malaysia')) return 'MY';
  if (normalized.includes('singapore')) return 'SG';
  if (normalized.includes('global') || normalized.includes('usa') || normalized.includes('united states')) {
    return 'US';
  }
  if (normalized.includes('united kingdom')) return 'UK';
  if (normalized.includes('penang')) return 'PG';
  if (normalized.includes('kuala')) return 'KL';

  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map(word => word[0])
      .join('')
      .toUpperCase();
  }

  return label.slice(0, 2).toUpperCase();
}

export function formatProjectMeta(project: KeywordManagerProject): string {
  const parts: string[] = [];
  if (project.domain?.trim()) {
    parts.push(project.domain.trim());
  }
  const location = locationCodeAbbreviation(project.locationCode);
  if (location) {
    parts.push(location);
  }
  return parts.join(' · ');
}
