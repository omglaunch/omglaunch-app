export type SiloBuilderDeepLinkParams = {
  seed?: string;
  geography?: string;
  location?: string;
  mode?: 'quick';
  tab?: 'keyword' | 'competitor';
  import?: string;
};

export type SiloInitPrefill = {
  seedKeyword?: string;
  geography?: string;
  activeTab?: 'keyword' | 'competitor';
  mode?: 'quick';
};

export function buildSiloBuilderHref(params: SiloBuilderDeepLinkParams): string {
  const search = new URLSearchParams();

  const seed = params.seed?.trim();
  const geography = params.geography?.trim() ?? params.location?.trim();

  if (seed) {
    search.set('seed', seed);
  }

  if (geography) {
    search.set('geography', geography);
  }

  if (params.mode === 'quick') {
    search.set('mode', 'quick');
  }

  if (params.tab === 'competitor') {
    search.set('tab', 'competitor');
  }

  const importId = params.import?.trim();
  if (importId) {
    search.set('import', importId);
  }

  const query = search.toString();
  return `/dashboard/silo-builder${query ? `?${query}` : ''}`;
}

export function parseSiloBuilderDeepLinkParams(
  searchParams: Pick<URLSearchParams, 'get'>
): SiloInitPrefill | null {
  const seedKeyword = searchParams.get('seed')?.trim() ?? '';
  const geography =
    searchParams.get('geography')?.trim() ??
    searchParams.get('location')?.trim() ??
    undefined;
  const mode = searchParams.get('mode')?.trim() === 'quick' ? 'quick' : undefined;
  const activeTab =
    searchParams.get('tab')?.trim() === 'competitor' ? 'competitor' : 'keyword';

  if (!seedKeyword && !geography) {
    return null;
  }

  return {
    seedKeyword: seedKeyword || undefined,
    geography,
    activeTab,
    mode,
  };
}
