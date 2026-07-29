import { hostnameFromUrl } from '@/lib/ai-visibility/aeo-brand-profile';

export type BrandUrlValidationResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

function normalizeDomainHost(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '')
      .toLowerCase() || null;
  }
}

function registrableDomain(host: string): string {
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) {
    return host;
  }
  return parts.slice(-2).join('.');
}

/**
 * Ensures the client brand URL aligns with the project domain field.
 * Hard-fails on clear mismatches; warns when project.domain is unset.
 */
export function validateBrandUrlAgainstProjectDomain(input: {
  primaryUrl: string;
  projectDomain?: string | null;
}): BrandUrlValidationResult {
  const brandHost = hostnameFromUrl(input.primaryUrl);
  if (!brandHost) {
    return { ok: false, error: 'Enter a valid primary website URL.' };
  }

  const projectHost = normalizeDomainHost(input.projectDomain ?? '');
  if (!projectHost) {
    return {
      ok: true,
      warning:
        'No project domain is set — add the client website on the project to lock brand URL matching.',
    };
  }

  const brandRoot = registrableDomain(brandHost);
  const projectRoot = registrableDomain(projectHost);

  if (brandHost === projectHost || brandHost.endsWith(`.${projectHost}`) || projectHost.endsWith(`.${brandHost}`)) {
    return { ok: true };
  }

  if (brandRoot === projectRoot) {
    return { ok: true };
  }

  return {
    ok: false,
    error: `Brand URL (${brandHost}) must match the project domain (${projectHost}). Update the project domain or use the client's website.`,
  };
}
