export function buildSiloArticleStudioHref(node: {
  title: string;
  targetKeyword?: string | null;
}): string {
  const params = new URLSearchParams({
    targetKeyword: (node.targetKeyword || node.title).trim(),
    title: node.title.trim(),
  });
  return `/article-studio?${params.toString()}`;
}

export function buildSiloBriefStudioHref(input: {
  siloNodeId: string;
  siloProjectId: string;
  siloProjectTitle: string;
  title: string;
  targetKeyword?: string | null;
  intent?: string | null;
}): string {
  const params = new URLSearchParams({
    source: 'silo-builder',
    siloNodeId: input.siloNodeId,
    siloProjectId: input.siloProjectId,
    siloProjectTitle: input.siloProjectTitle,
    targetKeyword: (input.targetKeyword || input.title).trim(),
    title: input.title.trim(),
  });

  if (input.intent?.trim()) {
    params.set('intent', input.intent.trim());
  }

  return `/article-studio?${params.toString()}`;
}
