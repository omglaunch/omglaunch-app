export type SiloLinkMetadata = {
  siloNodeId?: string;
  siloProjectId?: string;
  siloSource?: string;
  articleStudioHistoryId?: string;
  wpPostId?: number;
  wpPostStatus?: 'draft' | 'publish';
  wpPublishedAt?: string;
  state?: string;
};

export function parseSiloLinkMetadata(resultData: unknown): SiloLinkMetadata | null {
  if (!resultData || typeof resultData !== 'object') {
    return null;
  }

  const record = resultData as Record<string, unknown>;
  const siloNodeId =
    typeof record.siloNodeId === 'string' ? record.siloNodeId : undefined;

  if (!siloNodeId) {
    return null;
  }

  const wpPostStatus =
    record.wpPostStatus === 'publish' || record.wpPostStatus === 'draft'
      ? record.wpPostStatus
      : undefined;

  return {
    siloNodeId,
    siloProjectId:
      typeof record.siloProjectId === 'string' ? record.siloProjectId : undefined,
    siloSource:
      typeof record.siloSource === 'string' ? record.siloSource : undefined,
    articleStudioHistoryId:
      typeof record.articleStudioHistoryId === 'string'
        ? record.articleStudioHistoryId
        : undefined,
    wpPostId:
      typeof record.wpPostId === 'number' ? record.wpPostId : undefined,
    wpPostStatus,
    wpPublishedAt:
      typeof record.wpPublishedAt === 'string' ? record.wpPublishedAt : undefined,
    state: typeof record.state === 'string' ? record.state : undefined,
  };
}

export function mergeSiloLinkMetadata(
  resultData: Record<string, unknown>,
  metadata: SiloLinkMetadata
): Record<string, unknown> {
  return {
    ...resultData,
    siloNodeId: metadata.siloNodeId,
    siloProjectId: metadata.siloProjectId,
    siloSource: metadata.siloSource ?? 'silo-builder',
    articleStudioHistoryId: metadata.articleStudioHistoryId,
    wpPostId: metadata.wpPostId,
    wpPostStatus: metadata.wpPostStatus,
    wpPublishedAt: metadata.wpPublishedAt,
  };
}
