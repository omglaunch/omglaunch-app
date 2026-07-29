import { cleanBrandAlias } from '@/lib/ai-visibility/brand-context';
import {
  DEFAULT_ENTITY_TYPE,
  normalizeEntityType,
  type EntityType,
} from '@/lib/ai-visibility/entity-type';
import {
  formatSameAsUrlsInput,
  normalizeOptionalText,
  parseSameAsUrlsJson,
} from '@/lib/ai-visibility/nap-sameas';
import type { VisibilityRow } from '@/lib/ai-visibility/types';

export type { EntityType };

export type AeoBrandProfileRecord = {
  id: string;
  projectId: string;
  brandLabel: string;
  primaryUrl: string;
  brandAliases: string[];
  entityType: EntityType;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  sameAsUrls: string[];
};

export type UpsertAeoBrandProfileInput = {
  brandLabel: string;
  primaryUrl: string;
  brandAliases?: string[];
  entityType?: EntityType | string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  sameAsUrls?: string[];
};

export function normalizePrimaryUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Primary website URL is required.');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Enter a valid website URL (e.g. example.com).');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Website URL must use http or https.');
  }

  return parsed.toString();
}

export function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Default crawl URL from brand profile or project domain (client-safe). */
export function defaultDiscoverUrlFromProject(
  profile: Pick<AeoBrandProfileRecord, 'primaryUrl'> | null,
  projectDomain: string | null | undefined
): string {
  if (profile?.primaryUrl?.trim()) {
    return profile.primaryUrl.trim();
  }
  const domain = projectDomain?.trim();
  if (!domain) return '';
  return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
}

/** Build citation-matching aliases from label + URL + optional extras. */
export function buildBrandAliases(input: {
  brandLabel: string;
  primaryUrl: string;
  extraAliases?: string[];
}): string[] {
  const aliases = new Set<string>();
  const label = input.brandLabel.trim();
  if (label) {
    aliases.add(label);
  }

  const host = hostnameFromUrl(input.primaryUrl);
  if (host) {
    aliases.add(host);
    aliases.add(`*.${host.split('.').slice(-2).join('.')}.*`);
  }

  for (const raw of input.extraAliases ?? []) {
    const cleaned = cleanBrandAlias(raw);
    if (cleaned) {
      aliases.add(cleaned);
    }
  }

  return Array.from(aliases);
}

export function parseBrandAliasesJson(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const aliases = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const cleaned = cleanBrandAlias(item);
    if (cleaned) {
      aliases.add(cleaned);
    }
  }

  return Array.from(aliases);
}

export function serializeBrandProfile(record: {
  id: string;
  projectId: string;
  brandLabel: string;
  primaryUrl: string;
  brandAliases: unknown;
  entityType?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  sameAsUrls?: unknown;
}): AeoBrandProfileRecord {
  return {
    id: record.id,
    projectId: record.projectId,
    brandLabel: record.brandLabel.trim(),
    primaryUrl: record.primaryUrl.trim(),
    brandAliases: parseBrandAliasesJson(record.brandAliases),
    entityType: normalizeEntityType(record.entityType ?? DEFAULT_ENTITY_TYPE),
    contactPhone: normalizeOptionalText(record.contactPhone),
    contactEmail: normalizeOptionalText(record.contactEmail),
    address: normalizeOptionalText(record.address),
    sameAsUrls: parseSameAsUrlsJson(record.sameAsUrls),
  };
}

export { formatSameAsUrlsInput, parseSameAsUrlsInput } from '@/lib/ai-visibility/nap-sameas';

export function stampVisibilityRowBrand(
  row: VisibilityRow,
  profile: Pick<AeoBrandProfileRecord, 'brandLabel' | 'primaryUrl' | 'brandAliases'>,
  projectId: string
): VisibilityRow {
  const brandFields = resolveBrandFieldsForRow(profile);
  return {
    ...row,
    projectId,
    userTargetUrl: brandFields.userTargetUrl,
    brandAliases: brandFields.brandAliases,
  };
}

export function resolveBrandFieldsForRow(
  profile: Pick<AeoBrandProfileRecord, 'brandLabel' | 'primaryUrl' | 'brandAliases'>
): { userTargetUrl: string; brandAliases: string[] } {
  return {
    userTargetUrl: profile.primaryUrl,
    brandAliases:
      profile.brandAliases.length > 0
        ? profile.brandAliases
        : buildBrandAliases({
            brandLabel: profile.brandLabel,
            primaryUrl: profile.primaryUrl,
          }),
  };
}

export function filterRowsByProject(
  rows: VisibilityRow[],
  projectId: string | null | undefined
): VisibilityRow[] {
  if (!projectId?.trim()) {
    return [];
  }
  return rows.filter(row => row.projectId === projectId);
}

/** Aliases stored in DB that were manually added (not auto-derived from label + URL). */
export function deriveManualAliasesFromProfile(
  profile: Pick<AeoBrandProfileRecord, 'brandLabel' | 'primaryUrl' | 'brandAliases'>
): string[] {
  const auto = new Set(
    buildBrandAliases({
      brandLabel: profile.brandLabel,
      primaryUrl: profile.primaryUrl,
    })
  );
  return profile.brandAliases.filter(alias => !auto.has(alias));
}

export function parseExtraAliasesInput(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/** Parse comma/newline brand tokens from the GSC import field. */
export function parseGscBrandsInput(input: string): string[] {
  return parseExtraAliasesInput(input);
}

/** Human-readable brand tokens for the GSC exclusion field (no wildcard patterns). */
export function formatGscBrandsInput(
  profile: Pick<AeoBrandProfileRecord, 'brandLabel' | 'primaryUrl' | 'brandAliases'>
): string {
  const tokens = new Set<string>();
  if (profile.brandLabel.trim()) {
    tokens.add(profile.brandLabel.trim());
  }
  const host = hostnameFromUrl(profile.primaryUrl);
  if (host) {
    tokens.add(host);
  }
  for (const alias of deriveManualAliasesFromProfile(profile)) {
    tokens.add(alias);
  }
  return Array.from(tokens).join(', ');
}

/** Derive a Search Console property id from the client primary URL. */
export function gscPropertyFromPrimaryUrl(primaryUrl: string): string {
  const host = hostnameFromUrl(primaryUrl);
  return host ? `sc-domain:${host}` : '';
}

/** Merge GSC exclusion tokens into manual profile aliases (deduped). */
export function mergeGscTokensIntoManualAliases(
  profile: Pick<AeoBrandProfileRecord, 'brandLabel' | 'primaryUrl' | 'brandAliases'>,
  gscTokens: string[]
): string[] {
  const manual = new Set(deriveManualAliasesFromProfile(profile));
  for (const token of gscTokens) {
    const cleaned = cleanBrandAlias(token);
    if (cleaned) {
      manual.add(cleaned);
    }
    // Preserve domain-style tokens GSC uses for exclusion even if cleanBrandAlias strips dots
    const trimmed = token.trim();
    if (trimmed && trimmed.includes('.') && !trimmed.includes('*')) {
      manual.add(trimmed);
    }
  }
  return Array.from(manual);
}
