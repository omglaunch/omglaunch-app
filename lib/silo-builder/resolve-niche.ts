function sanitizeDomain(domain: string): string {
  return domain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

export function resolveKeywordSiloNiche(seedKeyword: string, niche?: string): string {
  const trimmedNiche = niche?.trim();
  if (trimmedNiche) {
    return trimmedNiche;
  }

  const trimmedSeed = seedKeyword.trim();
  return `Searchers and businesses interested in ${trimmedSeed}`;
}

export function resolveCompetitorSiloNiche(domain: string, niche?: string): string {
  const trimmedNiche = niche?.trim();
  if (trimmedNiche) {
    return trimmedNiche;
  }

  const cleanDomain = sanitizeDomain(domain);
  return `Market operators competing with ${cleanDomain}`;
}
