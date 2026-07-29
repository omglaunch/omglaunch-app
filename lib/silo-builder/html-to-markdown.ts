function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

export function stripMarkdownCodeFences(text: string): string {
  let output = text.trim();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next = output
      .replace(/^```(?:html|markdown|md|text)?\s*\r?\n/i, '')
      .replace(/\r?\n?```\s*$/i, '')
      // Orphan fence lines (e.g. ``` after an H1) must not wrap the rest as a code block.
      .replace(/^\s*```(?:html|markdown|md|text)?\s*$/gim, '')
      .trim();

    if (next === output) {
      break;
    }

    output = next;
  }

  return output;
}

function looksLikeHtml(text: string): boolean {
  return /<(h[1-6]|p|div|ul|ol|li|br|strong|em|a|pre|code)\b/i.test(text);
}

function looksLikeMarkdown(text: string): boolean {
  return (
    /^#{1,6}\s/m.test(text) ||
    /^[-*+]\s/m.test(text) ||
    /^\d+\.\s/m.test(text) ||
    /\*\*[^*]+\*\*/m.test(text)
  );
}

function normalizeMarkdownLists(markdown: string): string {
  return markdown
    .split('\n')
    .map(line => {
      // Indented list markers (especially 4+ spaces) render as code blocks in MD.
      if (/^\s+([-*+]|\d+\.)\s/.test(line)) {
        return line.replace(/^\s+/, '');
      }
      return line;
    })
    .join('\n');
}

function dedupeLeadingHeading(markdown: string): string {
  const lines = markdown.split('\n');
  const firstHeadingIndex = lines.findIndex(line => /^#\s+\S/.test(line));
  if (firstHeadingIndex < 0) {
    return markdown;
  }

  const firstHeading = lines[firstHeadingIndex].replace(/^#\s+/, '').trim();
  for (let index = firstHeadingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    if (/^#\s+\S/.test(line) && line.replace(/^#\s+/, '').trim() === firstHeading) {
      lines.splice(index, 1);
      if (lines[index]?.trim() === '') {
        lines.splice(index, 1);
      }
    }
    break;
  }

  return lines.join('\n');
}

function normalizeMarkdown(markdown: string): string {
  let output = stripMarkdownCodeFences(markdown);
  output = normalizeMarkdownLists(output);
  output = dedupeLeadingHeading(output);
  output = output.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return output;
}

function prependTitleIfMissing(markdown: string, title?: string): string {
  if (!title?.trim()) {
    return markdown;
  }

  const trimmedTitle = title.trim();
  if (markdown.startsWith(`# ${trimmedTitle}`)) {
    return markdown;
  }

  if (/^#\s/m.test(markdown)) {
    return markdown;
  }

  return `# ${trimmedTitle}\n\n${markdown}`;
}

function convertBlockTags(html: string): string {
  let output = html;

  output = output.replace(/<br\s*\/?>/gi, '\n');

  output = output.replace(
    /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (_, content) => `${decodeHtmlEntities(content).trim()}\n\n`
  );
  output = output.replace(
    /<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    (_, content) => `${decodeHtmlEntities(content.replace(/<[^>]+>/g, '')).trim()}\n\n`
  );
  output = output.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, content) =>
    decodeHtmlEntities(content).trim()
  );

  output = output.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, content) => `# ${stripTags(content)}\n\n`);
  output = output.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, content) => `## ${stripTags(content)}\n\n`);
  output = output.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, content) => `### ${stripTags(content)}\n\n`);
  output = output.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, content) => `#### ${stripTags(content)}\n\n`);
  output = output.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, content) => `##### ${stripTags(content)}\n\n`);
  output = output.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, content) => `###### ${stripTags(content)}\n\n`);

  output = output.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => `- ${stripTags(content)}\n`);
  output = output.replace(/<\/?ul[^>]*>/gi, '\n');
  output = output.replace(/<\/?ol[^>]*>/gi, '\n');

  output = output.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => `${stripTags(content)}\n\n`);
  output = output.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, (_, content) => {
    const inner = decodeHtmlEntities(content.replace(/<[^>]+>/g, '\n')).trim();
    return inner ? `${inner}\n\n` : '';
  });

  output = output.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, content) => `**${stripTags(content)}**`);
  output = output.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, content) => `**${stripTags(content)}**`);
  output = output.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, content) => `*${stripTags(content)}*`);
  output = output.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, content) => `*${stripTags(content)}*`);

  output = output.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, content) => {
    const label = stripTags(content);
    return label ? `[${label}](${href})` : href;
  });

  output = output.replace(/<[^>]+>/g, '');
  output = decodeHtmlEntities(output);

  const normalized = normalizeMarkdown(output.replace(/\n{3,}/g, '\n\n').trim());
  return normalizeMarkdownLists(normalized);
}

/** Normalize raw Gemini output before persisting on SiloNode.content. */
export function normalizeGeneratedArticleContent(text: string): string {
  const trimmed = stripMarkdownCodeFences(text.trim());
  if (!trimmed) {
    return '';
  }

  if (looksLikeHtml(trimmed)) {
    return trimmed;
  }

  if (looksLikeMarkdown(trimmed)) {
    return normalizeMarkdown(trimmed);
  }

  return `<div>${trimmed.replace(/\n/g, '<br/>')}</div>`;
}

export function htmlToMarkdown(html: string, title?: string): string {
  const normalized = stripMarkdownCodeFences(html.trim());
  if (!normalized) {
    return title ? `# ${title.trim()}\n\n` : '';
  }

  if (!looksLikeHtml(normalized) && looksLikeMarkdown(normalized)) {
    return prependTitleIfMissing(normalizeMarkdown(normalized), title);
  }

  const markdown = convertBlockTags(normalized);
  if (!markdown) {
    return title ? `# ${title.trim()}\n\n` : '';
  }

  return prependTitleIfMissing(markdown, title);
}
