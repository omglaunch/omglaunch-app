import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisCheck } from "@/lib/analysis-data";
import type { ScrapePageData } from "@/lib/scraper";

export type ActionPlanItem = {
  title: string;
  reasoning: string;
  currentText: string;
  suggestedText: string;
};

export type GEOEvaluation = {
  geoScore: number;
  analysis: string;
  actionPlan: ActionPlanItem[];
  bonusTip: string;
};

const SYSTEM_PROMPT = `You are an expert Generative Engine Optimization (GEO) auditor. Evaluate how well a web page is optimized to be cited and surfaced by AI-powered search engines and answer engines.

Score the page's GEO readiness from 0 to 100 based on title relevance, heading structure, keyword alignment, content depth, and clarity for generative retrieval.

Respond in strict JSON with:
- geoScore: integer 0-100
- analysis: 1-2 sentences on the single biggest area for improvement
- actionPlan: exactly 3 high-impact, immediate "Action Items" to improve the page's GEO score. Each item must:
  - title: short action title (e.g. "Rewrite H1 for keyword intent")
  - reasoning: why this change helps SEO and generative retrieval
  - currentText: the exact problematic text from the scraped page data (title, heading, or missing element description). Quote real text from the page when possible.
  - suggestedText: your rewritten, keyword-optimized replacement the user can copy and paste
- bonusTip: one separate strategic insight (2-4 sentences) for long-term GEO positioning—think content architecture, topical authority, entity coverage, or citation-worthy depth beyond the immediate fixes above

Prioritize the highest-impact fixes in actionPlan. Use the target keyword naturally in suggestedText. Do not invent page content that was not implied by the scraped data. Keep bonusTip distinct from the three action items—no copy-paste rewrites, focus on durable strategy.`;

export async function evaluateGEO(
  scrapedData: ScrapePageData,
  targetKeyword: string
): Promise<GEOEvaluation> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  const pageContext = [
    `Target keyword: ${targetKeyword}`,
    `Title: ${scrapedData.title || "(none)"}`,
    `Headings: ${scrapedData.headings.length > 0 ? scrapedData.headings.join(" | ") : "(none)"}`,
    `Word count: ${scrapedData.wordCount}`,
  ].join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Evaluate this page's GEO readiness:\n\n${pageContext}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          geoScore: {
            type: Type.INTEGER,
            description: "GEO readiness score from 0 to 100",
          },
          analysis: {
            type: Type.STRING,
            description:
              "Brief 1-2 sentence explanation of the biggest area for improvement",
          },
          actionPlan: {
            type: Type.ARRAY,
            description:
              "Exactly 3 high-impact, immediate action items to improve GEO score",
            items: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "Short action title",
                },
                reasoning: {
                  type: Type.STRING,
                  description: "Why this change helps SEO and GEO",
                },
                currentText: {
                  type: Type.STRING,
                  description:
                    "Exact problematic text from the scraped page, or description of what is missing",
                },
                suggestedText: {
                  type: Type.STRING,
                  description:
                    "Rewritten, keyword-optimized text the user can copy and paste",
                },
              },
              required: ["title", "reasoning", "currentText", "suggestedText"],
            },
          },
          bonusTip: {
            type: Type.STRING,
            description:
              "One long-term strategic GEO insight distinct from the three immediate action items",
          },
        },
        required: ["geoScore", "analysis", "actionPlan", "bonusTip"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  const parsed = JSON.parse(text) as GEOEvaluation;

  return {
    geoScore: Math.max(0, Math.min(100, Math.round(parsed.geoScore))),
    analysis: parsed.analysis,
    actionPlan: parsed.actionPlan ?? [],
    bonusTip: parsed.bonusTip ?? "",
  };
}

export type AnalysisExecutiveSummary = {
  summaryText: string;
  overallScore: number;
};

const ANALYSIS_SUMMARY_SYSTEM_PROMPT = `You are an expert AI-readiness auditor. You receive programmatic scores (0-100) for eleven page checks plus the page meta description.

Your job:
1. Write summaryText: a cohesive, authoritative executive statement (2-3 sentences) explaining the page's current AI-readiness state. Reference the strongest and weakest areas when relevant. Be specific and professional.
2. Compute overallScore: a single 0-100 score derived from the programmatic metrics. Weight performance, structured data, accessibility, and semantic markup slightly higher than cosmetic checks. Round to one decimal place.

Base your assessment strictly on the provided metrics and meta description. Do not invent page content.`;

export async function generateAnalysisExecutiveSummary(
  url: string,
  metaDescription: string,
  checks: AnalysisCheck[]
): Promise<AnalysisExecutiveSummary> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  const metricsContext = [
    `URL: ${url}`,
    `Meta description: ${metaDescription || "(none)"}`,
    "",
    "Programmatic check scores:",
    ...checks.map(
      check =>
        `- ${check.question}: ${check.score}/100${check.category ? ` (${check.category})` : ""}`
    ),
  ].join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Generate an AI-readiness executive summary for this page:\n\n${metricsContext}`,
    config: {
      systemInstruction: ANALYSIS_SUMMARY_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          summaryText: {
            type: Type.STRING,
            description:
              "Cohesive executive statement on the page's AI-readiness (2-3 sentences)",
          },
          overallScore: {
            type: Type.NUMBER,
            description:
              "Weighted overall AI-readiness score from 0 to 100, one decimal place",
          },
        },
        required: ["summaryText", "overallScore"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  const parsed = JSON.parse(text) as AnalysisExecutiveSummary;

  return {
    summaryText: parsed.summaryText,
    overallScore:
      Math.round(Math.max(0, Math.min(100, parsed.overallScore)) * 10) / 10,
  };
}

export type GeminiNamedEntity = {
  entityName: string;
  category: string;
  salience: number;
  description: string;
  sourceUrl?: string;
  sourceUrls?: string[];
};

export type ExtractNamedEntitiesOptions = {
  includeSourceUrls?: boolean;
  validSourceUrls?: string[];
  defaultSourceUrl?: string;
};

export type GeminiEntityRelationship = {
  source: string;
  target: string;
  label: string;
};

export type GeminiNamedEntityAnalysis = {
  entities: GeminiNamedEntity[];
  relationships: GeminiEntityRelationship[];
};

const NER_SYSTEM_INSTRUCTION = `Analyze the provided text. Identify all Named Entities. Return a JSON object with:
- entities: an array of objects, where each object has: entityName, category (Person, Organization, Location, Product, Concept), salience (0.0 to 1.0), description (a brief explanation of the entity's relevance), sourceUrl (the URL of the source block where this entity was found), and sourceUrls (all URLs from the input that mention this entity; use a single-item array if only one source applies).
- relationships: an array of objects with source (entityName), target (entityName), and label (brief relationship description between the two entities).

When the input contains labeled source blocks with URLs, sourceUrl must exactly match one of those URLs. Prefer the highest-ranked / first-listed source as sourceUrl when an entity appears in multiple blocks, but list every matching URL in sourceUrls.

Focus on entities most relevant to the topic. Limit to the 25 most salient entities. Include relationships only between identified entities.`;

export async function extractNamedEntitiesFromText(
  text: string,
  contextLabel: string,
  options?: ExtractNamedEntitiesOptions
): Promise<GeminiNamedEntityAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (!text.trim()) {
    return { entities: [], relationships: [] };
  }

  const ai = new GoogleGenAI({ apiKey });
  const includeSourceUrls = options?.includeSourceUrls ?? false;

  const entityProperties: Record<string, unknown> = {
    entityName: { type: Type.STRING },
    category: { type: Type.STRING },
    salience: { type: Type.NUMBER },
    description: { type: Type.STRING },
  };

  const entityRequired = ['entityName', 'category', 'salience', 'description'];

  if (includeSourceUrls) {
    entityProperties.sourceUrl = { type: Type.STRING };
    entityProperties.sourceUrls = {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    };
    entityRequired.push('sourceUrl', 'sourceUrls');
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `${contextLabel}\n\n${text}`,
    config: {
      systemInstruction: NER_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          entities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: entityProperties,
              required: entityRequired,
            },
          },
          relationships: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                target: { type: Type.STRING },
                label: { type: Type.STRING },
              },
              required: ['source', 'target', 'label'],
            },
          },
        },
        required: ['entities', 'relationships'],
      },
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error('Gemini returned an empty response');
  }

  const parsed = JSON.parse(responseText) as GeminiNamedEntityAnalysis;

  return {
    entities: parsed.entities ?? [],
    relationships: parsed.relationships ?? [],
  };
}

export type GeminiSchemaEntity = {
  entityName: string;
  schemaType: string;
  description: string;
  sameAs: string[];
};

const ALLOWED_SCHEMA_TYPES = ['Person', 'Organization', 'Product', 'Place', 'Thing'] as const;
type SchemaOrgType = (typeof ALLOWED_SCHEMA_TYPES)[number];

const CATEGORY_TO_SCHEMA_TYPE: Record<string, SchemaOrgType> = {
  Person: 'Person',
  Organization: 'Organization',
  Location: 'Place',
  Product: 'Product',
  Concept: 'Thing',
};

const SCHEMA_GENERATION_INSTRUCTION = `You are a structured data expert. Assign each named entity its own specific Schema.org @type — never default everything to Thing.

Use these category-to-type mappings as your baseline (pick a more specific valid Schema.org subtype only when clearly justified):
- Person (people, authors, athletes) → Person
- Organization (brands, companies, teams, publishers) → Organization
- Location (cities, countries, venues, regions) → Place
- Product (gear, equipment, SKUs, software, services sold as products) → Product
- Concept (abstract topics, methodologies) → Thing

Allowed schemaType values: Person, Organization, Product, Place, Thing.
Use Thing only when no Person, Organization, Product, or Place type applies.

For each entity, return:
- entityName: exact name from input
- schemaType: the most specific allowed type for that entity
- description: brief relevance summary
- sameAs: array of authoritative URLs (Wikipedia, official website, Wikidata, etc.) when you are confident they refer to this entity; otherwise an empty array

Only include sameAs URLs you are highly confident are correct. Never invent URLs.`;

function resolveEntitySchemaType(category: string, geminiType: string | undefined): SchemaOrgType {
  const categoryDefault = CATEGORY_TO_SCHEMA_TYPE[category] ?? 'Thing';
  const normalized = (geminiType ?? '').trim();

  if (!ALLOWED_SCHEMA_TYPES.includes(normalized as SchemaOrgType)) {
    return categoryDefault;
  }

  if (normalized !== 'Thing') {
    return normalized as SchemaOrgType;
  }

  return categoryDefault;
}

function slugifyEntityId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function buildJsonLdDocument(
  markup: GeminiSchemaEntity[],
  pageUrl: string,
  keyword: string
): string {
  const entityNodes = markup.map(entity => {
    const entityFragment = slugifyEntityId(entity.entityName);
    const node: Record<string, unknown> = {
      '@type': entity.schemaType,
      '@id': `${pageUrl}#entity-${entityFragment}`,
      name: entity.entityName,
      description: entity.description,
    };

    const sameAs = entity.sameAs.filter(url => typeof url === 'string' && url.startsWith('http'));
    if (sameAs.length > 0) {
      node.sameAs = sameAs;
    }

    return node;
  });

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': pageUrl,
        url: pageUrl,
        name: keyword,
        mentions: entityNodes.map(node => ({ '@id': node['@id'] })),
      },
      ...entityNodes,
    ],
  };

  return `<script type="application/ld+json">\n${JSON.stringify(graph, null, 2)}\n</script>`;
}

export async function generateNamedEntitySchemaJsonLd(
  entities: Array<{
    entityName: string;
    category: string;
    salience: number;
    description: string;
  }>,
  pageUrl: string,
  keyword: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (entities.length === 0) {
    throw new Error('No entities available for schema generation');
  }

  const ai = new GoogleGenAI({ apiKey });

  const entityContext = entities
    .map(
      entity =>
        `- ${entity.entityName} (${entity.category}, salience ${entity.salience.toFixed(2)}): ${entity.description}`
    )
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Page URL: ${pageUrl}\nPrimary keyword: ${keyword}\n\nEntities:\n${entityContext}`,
    config: {
      systemInstruction: SCHEMA_GENERATION_INSTRUCTION,
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          entities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                entityName: { type: Type.STRING },
                schemaType: {
                  type: Type.STRING,
                  enum: [...ALLOWED_SCHEMA_TYPES],
                },
                description: { type: Type.STRING },
                sameAs: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['entityName', 'schemaType', 'description', 'sameAs'],
            },
          },
        },
        required: ['entities'],
      },
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error('Gemini returned an empty response');
  }

  const parsed = JSON.parse(responseText) as { entities: GeminiSchemaEntity[] };
  const markupByName = new Map(
    (parsed.entities ?? []).map(entity => [entity.entityName.trim().toLowerCase(), entity])
  );

  const normalizedMarkup: GeminiSchemaEntity[] = entities.map(entity => {
    const matched = markupByName.get(entity.entityName.trim().toLowerCase());
    const schemaType = resolveEntitySchemaType(
      entity.category,
      matched?.schemaType
    );

    if (matched) {
      return {
        entityName: entity.entityName,
        schemaType,
        description: matched.description || entity.description,
        sameAs: matched.sameAs ?? [],
      };
    }

    return {
      entityName: entity.entityName,
      schemaType,
      description: entity.description,
      sameAs: [],
    };
  });

  return buildJsonLdDocument(normalizedMarkup, pageUrl, keyword);
}
