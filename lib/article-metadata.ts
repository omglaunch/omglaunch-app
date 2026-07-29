export type ArticleMetadata = {
  seoTitle: string | null;
  metaDescription: string | null;
};

function extractField(content: string, label: string): string | null {
  const patterns = [
    new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+?)(?:\\n|$)`, 'i'),
    new RegExp(`^\\*\\s+\\*\\*${label}:\\*\\*\\s*(.+?)(?:\\n|$)`, 'im'),
    new RegExp(`^${label}:\\s*(.+?)(?:\\n|$)`, 'im'),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return null;
}

function extractHeadingTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function extractLeadParagraph(content: string): string | null {
  const lines = content.split('\n');
  const paragraphLines: string[] = [];
  let passedHeading = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (paragraphLines.length > 0) {
        break;
      }
      continue;
    }

    if (trimmed.startsWith('#')) {
      passedHeading = true;
      continue;
    }

    if (!passedHeading) {
      continue;
    }

    if (trimmed.startsWith('![') || trimmed.startsWith('|') || trimmed.startsWith('- ')) {
      continue;
    }

    paragraphLines.push(stripMarkdownInline(trimmed));

    if (paragraphLines.join(' ').length >= 120) {
      break;
    }
  }

  const paragraph = paragraphLines.join(' ').replace(/\s+/g, ' ').trim();
  return paragraph.length >= 40 ? paragraph : null;
}

export function truncateMetaDescription(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 160) {
    return normalized;
  }

  const truncated = normalized.slice(0, 157).trim();
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 120) {
    return `${truncated.slice(0, lastSpace).trim()}…`;
  }

  return `${truncated}…`;
}

function keywordPresentInMeta(meta: string, keyword: string): boolean {
  const normalizedMeta = meta.toLowerCase();
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  if (normalizedMeta.includes(normalizedKeyword)) {
    return true;
  }

  const tokens = normalizedKeyword.split(/\s+/).filter(token => token.length > 3);
  if (tokens.length === 0) {
    return normalizedMeta.includes(normalizedKeyword);
  }

  const matchedTokens = tokens.filter(token => normalizedMeta.includes(token));
  return matchedTokens.length >= Math.ceil(tokens.length * 0.6);
}

const GENERIC_META_PATTERNS = [
  /^learn .+ with expert guidance/i,
  /^discover expert guidance on/i,
  /^expert insights, practical advice/i,
  /practical tips, trusted insights, and actionable steps/i,
];

export function isMetaDescriptionAcceptable(meta: string, keyword: string): boolean {
  const trimmed = meta.trim();
  if (trimmed.length < 100 || trimmed.length > 160) {
    return false;
  }

  if (!keywordPresentInMeta(trimmed, keyword)) {
    return false;
  }

  if (GENERIC_META_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return false;
  }

  return true;
}

/** @deprecated Use server-side GEO meta optimization instead. */
export function buildFallbackMetaDescription(
  keyword: string,
  seoTitle?: string | null,
  content?: string | null
): string {
  const trimmedKeyword = keyword.trim();
  const trimmedSeoTitle = seoTitle?.trim() ?? '';

  const leadParagraph = content?.trim() ? extractLeadParagraph(content) : null;
  if (leadParagraph) {
    return truncateMetaDescription(leadParagraph);
  }

  if (trimmedKeyword && trimmedSeoTitle) {
    return truncateMetaDescription(
      `Learn ${trimmedKeyword} with expert guidance. ${trimmedSeoTitle}. Practical tips, trusted insights, and actionable steps.`
    );
  }

  if (trimmedSeoTitle) {
    return truncateMetaDescription(
      `${trimmedSeoTitle}. Expert insights, practical advice, and actionable recommendations you can trust.`
    );
  }

  if (trimmedKeyword) {
    return truncateMetaDescription(
      `Discover expert guidance on ${trimmedKeyword}. Practical tips, trusted insights, and actionable steps to help you succeed.`
    );
  }

  return '';
}

export function extractArticleMetadata(content: string, fallbackTitle?: string): ArticleMetadata {
  const seoTitle =
    extractField(content, 'SEO Title') ??
    extractHeadingTitle(content) ??
    fallbackTitle ??
    null;

  const metaDescription = extractField(content, 'Meta Description');

  return { seoTitle, metaDescription };
}

export function resolveArticleMetadata(
  content: string,
  keyword: string,
  saved?: { seoTitle?: string | null; metaDescription?: string | null }
): { seoTitle: string; metaDescription: string } {
  const extracted = extractArticleMetadata(content, keyword);

  const seoTitle =
    saved?.seoTitle?.trim() || extracted.seoTitle?.trim() || keyword.trim() || '';

  const metaDescription =
    saved?.metaDescription?.trim() || extracted.metaDescription?.trim() || '';

  return { seoTitle, metaDescription };
}
