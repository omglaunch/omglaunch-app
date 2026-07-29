import type { SeoAnalysisMetrics } from './seo-analysis-data';

export function getMockSeoAnalysis(): SeoAnalysisMetrics {
  return {
    url: 'https://www.99signals.com/best-affiliate-marketing-programs/',
    overallScore: 88.5,
    criteria: [
      {
        id: 'language-code',
        label: 'language code chosen',
        value: 'en',
        status: 'pass',
      },
      {
        id: 'target-keyword',
        label: 'keyword you think the page is targeting',
        value: 'affiliate marketing programs',
        status: 'pass',
      },
      {
        id: 'search-volume',
        label: 'search volume for target keyword',
        value: '33100 monthly searches on average',
        status: 'pass',
      },
      {
        id: 'robots-tag',
        label: 'content of the robots tag',
        value:
          'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
        status: 'warning',
        subtext:
          'It is not necessary to indicate "index,follow" in the robots tag, because it is its default value.',
      },
      {
        id: 'url-words',
        label: 'words in the URL',
        value: 'signals com best affiliate marketing programs',
        status: 'pass',
      },
      {
        id: 'meta-title',
        label: 'balise "meta title"',
        value: '33 Best Affiliate Marketing Programs for Marketers in 2024',
        status: 'pass',
        subtext: "58 characters, that's a good length.",
      },
      {
        id: 'meta-description',
        label: 'meta description tag',
        value:
          'Discover the top 33 affiliate marketing programs tailored for marketers and bloggers looking to elevate their earning potential.',
        status: 'pass',
        subtext:
          "128 caractères pour 18 mots dans la balise, c'est une bonne longueur (entre 110 et 170 caractères).",
      },
      {
        id: 'canonical-tag',
        label: 'canonical tag',
        value: 'https://www.99signals.com/best-affiliate-marketing-programs/',
        status: 'pass',
      },
      {
        id: 'main-h1',
        label: 'main title (H1 tag)',
        value: '33 Best Affiliate Marketing Programs for Marketers in 2024',
        status: 'pass',
      },
      {
        id: 'single-h1',
        label: 'a single H1 tag',
        value: 'Yes, the page has a single H1 tag',
        status: 'pass',
      },
      {
        id: 'hn-order',
        label: 'respect of the order of the H1 / Hn tags',
        value: '',
        status: 'fail',
        subtext:
          'An h3 tag is empty. => See the page map to identify any problems with titles',
      },
      {
        id: 'h2-count',
        label: 'number of H2 tags (level 2 subheadings)',
        value: 12,
        status: 'pass',
      },
      {
        id: 'h3-count',
        label: 'number of H3 tags (level 3 subtitles)',
        value: 39,
        status: 'warning',
        subtext:
          'There are too many H3 tags on the page. Do not exceed 30 H3 tags.',
      },
      {
        id: 'strong-count',
        label: 'number of strong tags',
        value: 277,
        status: 'fail',
        subtext:
          "There are too many strong tags on the page, so don't overuse them.",
      },
      {
        id: 'meta-title-h1-diff',
        label: 'different "meta title" and H1 tags',
        value: 'Yes, the tags are different',
        status: 'pass',
      },
      {
        id: 'text-code-ratio',
        label: 'ratio text / code',
        value: '10.32%',
        status: 'warning',
        subtext:
          "The ratio of text to code on the page is a little low (but don't focus on that).",
      },
      {
        id: 'total-words',
        label: 'total words',
        value: 6757,
        status: 'pass',
      },
      {
        id: 'relevant-words',
        label: 'relevant words',
        value: '4684 (69%)',
        status: 'pass',
      },
      {
        id: 'distinct-relevant-words',
        label: 'distinct relevant words',
        value: '1092 (23%)',
        status: 'fail',
        subtext:
          'The percentage of distinct relevant words is too low. This criterion does not count in the SEO score.',
      },
      {
        id: 'total-sentences',
        label: 'total sentences',
        value: 526,
        status: 'pass',
      },
      {
        id: 'sentences-over-4-words',
        label: 'sentences of more than 4 words',
        value: '446 (85%)',
        status: 'pass',
      },
      {
        id: 'internal-links',
        label: 'number of unique internal links',
        value: 69,
        status: 'pass',
      },
      {
        id: 'outbound-links',
        label: 'number of unique outbound links',
        value: 53,
        status: 'warning',
        subtext:
          'The number of outbound links on this page is too high. Try adding between 3 and 15 outbound links.',
      },
      {
        id: 'image-count',
        label: 'number of images',
        value: 41,
        status: 'pass',
      },
      {
        id: 'images-without-alt',
        label: 'number of images without alt attribute',
        value: 1,
        status: 'warning',
        subtext:
          'There are 1 images without alt attribute, it is not blocking, but it is better to always describe the images with alt attribute.',
      },
      {
        id: 'open-graph',
        label: 'balises open graph',
        value: 'Open graph tags are present.',
        status: 'pass',
      },
      {
        id: 'twitter-tags',
        label: 'balises twitter',
        value:
          'No twitter tag on the page (not a problem, considering the interest of Twitter...)',
        status: 'warning',
      },
      {
        id: 'footer-text',
        label: 'text in footer',
        value:
          "Extrait : ABOUT ME Hi there, I'm Sandeep Mallya! I'm an entrepreneur and digital ma [...] © 2016-24 99signals. All rights reserved.",
        status: 'warning',
        subtext:
          'Your footer contains 292 words. Footer text dilutes the content; use the footer sparingly, for legal information, copyrights or contact links.',
      },
    ],
    keywordFrequencies: [
      { text: 'affiliate', value: 142 },
      { text: 'marketing', value: 118 },
      { text: 'program', value: 96 },
      { text: 'network', value: 54 },
      { text: 'commission', value: 48 },
      { text: 'payment', value: 41 },
      { text: 'sale', value: 38 },
      { text: 'join', value: 32 },
      { text: 'tool', value: 28 },
      { text: 'platform', value: 24 },
      { text: 'revenue', value: 21 },
      { text: 'partner', value: 19 },
      { text: 'link', value: 17 },
      { text: 'offer', value: 15 },
      { text: 'brand', value: 12 },
    ],
  };
}
