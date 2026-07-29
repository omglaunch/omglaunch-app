export function buildSiloBriefContent(input: {
  title: string;
  targetKeyword: string;
  intent: string | null;
  projectTitle: string;
  variant?: 'draft' | 'synced';
}): string {
  const contentDirection =
    input.variant === 'synced'
      ? 'This article was generated in Silo Builder Content Factory and synced to Article Studio for editing, refinement, and publishing.'
      : 'Draft this silo article in Article Studio — no generation credits are used until you choose to write or generate content here.';

  return [
    `# SEO Content Brief: ${input.title}`,
    '',
    '## Strategy Overview',
    `* **Primary Keyword:** ${input.targetKeyword}`,
    `* **Target H1:** ${input.title}`,
    `* **Source:** Silo Builder · ${input.projectTitle}`,
    input.intent ? `* **Search Intent:** ${input.intent}` : '',
    '',
    '## Content Direction',
    contentDirection,
    '',
    '## Semantic SEO & Entities',
    `* **Primary Keyword:** ${input.targetKeyword}`,
    '* **Secondary Keywords & LSI Terms:** Expand from your silo semantic entity list.',
    '',
    '## Internal Linking Strategy',
    '* Link back to the pillar page using the anchor text from your silo map.',
  ]
    .filter(Boolean)
    .join('\n');
}
