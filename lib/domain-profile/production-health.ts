import { buildProductionManifestUrl } from '@/lib/domain-profile/urls';
import { safeParseDomainProfile, type DomainProfile } from '@/lib/domain-profile/schema';

export type ProductionManifestHealthStatus =
  | 'in_sync'
  | 'stale'
  | 'unreachable'
  | 'not_found'
  | 'invalid'
  | 'not_published'
  | 'no_url';

export type ProductionManifestHealthResult = {
  status: ProductionManifestHealthStatus;
  productionUrl: string | null;
  httpStatus: number | null;
  message: string;
  publishedName: string | null;
  liveName: string | null;
  checkedAt: string;
};

const FETCH_TIMEOUT_MS = 12_000;

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '127.0.0.1' || host === '::1') return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function compareManifests(published: DomainProfile, live: DomainProfile): boolean {
  return (
    published.name === live.name &&
    published.website === live.website &&
    published.entity_type === live.entity_type
  );
}

export async function checkProductionManifestHealth(input: {
  projectDomain?: string | null;
  primaryUrl?: string | null;
  publishedManifest: DomainProfile | null;
}): Promise<ProductionManifestHealthResult> {
  const checkedAt = new Date().toISOString();
  const productionUrl = buildProductionManifestUrl({
    projectDomain: input.projectDomain,
    primaryUrl: input.primaryUrl,
  });

  if (!productionUrl) {
    return {
      status: 'no_url',
      productionUrl: null,
      httpStatus: null,
      message: 'Set a project domain or brand primary URL to check production hosting.',
      publishedName: input.publishedManifest?.name ?? null,
      liveName: null,
      checkedAt,
    };
  }

  if (!input.publishedManifest) {
    return {
      status: 'not_published',
      productionUrl,
      httpStatus: null,
      message: 'Publish a manifest in omglaunch before checking the client domain.',
      publishedName: null,
      liveName: null,
      checkedAt,
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(productionUrl);
  } catch {
    return {
      status: 'no_url',
      productionUrl,
      httpStatus: null,
      message: 'Production URL is invalid.',
      publishedName: input.publishedManifest.name,
      liveName: null,
      checkedAt,
    };
  }

  if (isBlockedHostname(parsedUrl.hostname)) {
    return {
      status: 'unreachable',
      productionUrl,
      httpStatus: null,
      message: 'Production health check cannot probe local or private hostnames.',
      publishedName: input.publishedManifest.name,
      liveName: null,
      checkedAt,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(productionUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'omglaunch-manifest-health/1.0',
      },
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });

    if (response.status === 404) {
      return {
        status: 'not_found',
        productionUrl,
        httpStatus: 404,
        message:
          'No manifest at the client domain yet. Deploy via host matching or upload the published JSON.',
        publishedName: input.publishedManifest.name,
        liveName: null,
        checkedAt,
      };
    }

    if (!response.ok) {
      return {
        status: 'unreachable',
        productionUrl,
        httpStatus: response.status,
        message: `Client domain returned HTTP ${response.status}.`,
        publishedName: input.publishedManifest.name,
        liveName: null,
        checkedAt,
      };
    }

    const body: unknown = await response.json().catch(() => null);
    const parsed = safeParseDomainProfile(body);
    if (!parsed.success) {
      return {
        status: 'invalid',
        productionUrl,
        httpStatus: response.status,
        message: 'Client domain returned JSON that is not a valid domain profile.',
        publishedName: input.publishedManifest.name,
        liveName: null,
        checkedAt,
      };
    }

    const live = parsed.data;
    if (compareManifests(input.publishedManifest, live)) {
      return {
        status: 'in_sync',
        productionUrl,
        httpStatus: response.status,
        message: 'Live client manifest matches the published omglaunch record.',
        publishedName: input.publishedManifest.name,
        liveName: live.name,
        checkedAt,
      };
    }

    return {
      status: 'stale',
      productionUrl,
      httpStatus: response.status,
      message: `Client domain is live but differs from published (live: "${live.name}", published: "${input.publishedManifest.name}"). Re-deploy after publish.`,
      publishedName: input.publishedManifest.name,
      liveName: live.name,
      checkedAt,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Timed out reaching the client domain.'
        : 'Could not reach the client domain manifest URL.';

    return {
      status: 'unreachable',
      productionUrl,
      httpStatus: null,
      message,
      publishedName: input.publishedManifest.name,
      liveName: null,
      checkedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}
