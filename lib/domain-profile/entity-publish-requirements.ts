import { entityTypeLabel } from '@/lib/ai-visibility/entity-type';
import { normalizeOptionalText } from '@/lib/ai-visibility/nap-sameas';
import type { EntityType } from './schema';

export const LOCAL_NAP_ENTITY_TYPES = [
  'LocalBusiness',
  'MedicalOrganization',
] as const satisfies readonly EntityType[];

export type LocalNapEntityType = (typeof LOCAL_NAP_ENTITY_TYPES)[number];

export type ManifestPublishValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function entityTypeRequiresNap(entityType: EntityType): boolean {
  return (LOCAL_NAP_ENTITY_TYPES as readonly string[]).includes(entityType);
}

export function validateLocalEntityNap(input: {
  entityType: EntityType;
  brandLabel?: string | null;
  contactPhone?: string | null;
  address?: string | null;
}): ManifestPublishValidationResult {
  if (!entityTypeRequiresNap(input.entityType)) {
    return { ok: true };
  }

  const errors: string[] = [];
  const label = entityTypeLabel(input.entityType);

  if (!normalizeOptionalText(input.brandLabel)) {
    errors.push('Brand display name is required.');
  }
  if (!normalizeOptionalText(input.contactPhone)) {
    errors.push(`Phone is required for ${label} profiles before publish.`);
  }
  if (!normalizeOptionalText(input.address)) {
    errors.push(`Address is required for ${label} profiles before publish.`);
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function formatManifestPublishValidationError(
  result: Extract<ManifestPublishValidationResult, { ok: false }>
): string {
  return `${result.errors.join(' ')} Add NAP in Settings → Client Brands, then regenerate the draft.`;
}
