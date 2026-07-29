export const DOMAIN_PROFILE_WELL_KNOWN_PATH = '/.well-known/domain-profile.json';

export type ManifestHostingWebsiteInput = {
  projectDomain?: string | null;
  primaryUrl?: string | null;
};

/** Normalize project domain or brand primary URL to an https origin. */
export function resolveProductionWebsite(input: ManifestHostingWebsiteInput): string | null {
  const raw = input.primaryUrl?.trim() || input.projectDomain?.trim();
  if (!raw) return null;

  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
    if (!url.hostname) return null;
    return url.origin.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function buildProductionManifestUrl(input: ManifestHostingWebsiteInput): string | null {
  const origin = resolveProductionWebsite(input);
  if (!origin) return null;
  return `${origin}${DOMAIN_PROFILE_WELL_KNOWN_PATH}`;
}

export function buildDemoManifestUrl(projectId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}${DOMAIN_PROFILE_WELL_KNOWN_PATH}?projectId=${encodeURIComponent(projectId)}`;
}

export function buildRelativeDemoManifestPath(projectId: string): string {
  return `${DOMAIN_PROFILE_WELL_KNOWN_PATH}?projectId=${encodeURIComponent(projectId)}`;
}

export type ManifestHostingUrls = {
  demoUrl: string;
  productionUrl: string | null;
  website: string | null;
};

export function buildManifestHostingUrls(
  projectId: string,
  baseUrl: string,
  websiteInput: ManifestHostingWebsiteInput
): ManifestHostingUrls {
  const website = resolveProductionWebsite(websiteInput);
  return {
    demoUrl: buildDemoManifestUrl(projectId, baseUrl),
    productionUrl: website ? `${website}${DOMAIN_PROFILE_WELL_KNOWN_PATH}` : null,
    website,
  };
}
