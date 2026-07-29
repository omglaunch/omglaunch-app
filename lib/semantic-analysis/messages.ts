export function isDataForSeoEmptyResultMessage(message: string | null | undefined): boolean {
  if (!message?.trim()) {
    return false;
  }

  const normalized = message.trim().toLowerCase();

  return (
    normalized.includes('no related keywords') ||
    normalized.includes('no related questions') ||
    normalized.includes('no keyword ideas') ||
    normalized.includes('no related keyword')
  );
}

export function getSemanticSuggestionsEmptyMessage(options: {
  criteriaCount: number;
  totalWords: number;
  hasSearchFilter: boolean;
  semanticError?: string | null;
}): { tone: 'error' | 'info' | 'filter'; message: string } | null {
  if (options.criteriaCount > 0) {
    return null;
  }

  if (options.hasSearchFilter) {
    return {
      tone: 'filter',
      message: 'No semantic suggestions match your search filter.',
    };
  }

  if (options.semanticError?.trim()) {
    return {
      tone: 'error',
      message: options.semanticError.trim(),
    };
  }

  if (options.totalWords === 0) {
    return {
      tone: 'info',
      message:
        'No extractable page text was found. JavaScript-heavy sites (e.g. large e-commerce stores) often return a minimal HTML shell, so on-page semantic terms cannot be scored. Related keywords, questions, and named entities still use SERP and competitor data.',
    };
  }

  return {
    tone: 'info',
    message:
      'Analysis completed successfully, but no semantic terms met the scoring thresholds for this page. Try a deeper content URL or compare related keywords and entities from competitor SERPs.',
  };
}

export function getRelatedDataEmptyMessage(
  kind: 'keywords' | 'questions',
  error: string | null | undefined,
  isLoaded: boolean
): { tone: 'error' | 'info'; message: string } {
  if (error?.trim()) {
    if (isDataForSeoEmptyResultMessage(error)) {
      return {
        tone: 'info',
        message: error.trim(),
      };
    }

    return {
      tone: 'error',
      message: error.trim(),
    };
  }

  if (!isLoaded) {
    return {
      tone: 'info',
      message:
        kind === 'keywords'
          ? 'Related keywords will appear here once loaded.'
          : 'Related questions will appear here once loaded.',
    };
  }

  return {
    tone: 'info',
    message:
      kind === 'keywords'
        ? 'No related keywords match your search filter.'
        : 'No related questions match your search filter.',
  };
}
