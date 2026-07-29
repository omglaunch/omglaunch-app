export type ArticleExportFormat = 'md' | 'txt' | 'docx';

export function buildExportFilename(source: string, extension: ArticleExportFormat): string {
  const slug =
    source
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') || 'article';

  return `${slug}.${extension}`;
}
