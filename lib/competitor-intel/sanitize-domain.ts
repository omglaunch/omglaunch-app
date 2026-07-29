/** Strips protocol, www, paths, and trailing slashes from a competitor domain input. */
export function sanitizeTargetDomain(input: string): string {
  let domain = input.trim().toLowerCase();

  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/^www\./, '');
  domain = domain.split('/')[0] ?? domain;
  domain = domain.split('?')[0] ?? domain;
  domain = domain.split('#')[0] ?? domain;

  return domain.replace(/\/+$/, '').replace(/\.$/, '');
}

export function isValidSanitizedDomain(domain: string): boolean {
  if (!domain || domain.includes(' ') || domain.includes('/')) {
    return false;
  }

  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
    domain
  );
}
