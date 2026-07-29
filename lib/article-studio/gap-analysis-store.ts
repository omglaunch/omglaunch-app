'use client';

import { create } from 'zustand';
import type { VisibilityGapHydration } from '@/lib/ai-visibility/types';
import {
  createDefaultGapMetadata,
  type AeoExtractResult,
  type AeoStructureBlock,
  type AutoGenerateGapArticle,
  type FaqSchemaEntry,
  type GapArticleMetadata,
} from './gap-analysis-types';

type GapAnalysisUiState = {
  /** Rich-text editor body — kept separate from metadata */
  editorContent: string;
  metadata: GapArticleMetadata;
  isPublishing: boolean;
  publishError: string | null;
  sourceClusters: string[];
  sourceRoute: string | null;
  linkedPromptId: string | null;
  isExtractingAeo: boolean;
  isAutoGenerating: boolean;
  gapDraftHistoryId: string | null;
  isSavingGapDraft: boolean;
  gapDraftSaveStatus: 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';
};

type GapAnalysisActions = {
  reset: (input?: {
    title?: string;
    cluster?: string;
    geo?: { locationId: string; label: string };
    keywordTargets?: string[];
    sourceClusters?: string[];
    sourceRoute?: string | null;
  }) => void;
  setEditorContent: (content: string) => void;
  setMetadata: (metadata: GapArticleMetadata) => void;
  patchMetadata: (patch: Partial<GapArticleMetadata>) => void;
  setTitle: (title: string) => void;
  setCluster: (cluster: string) => void;
  setGeo: (geo: { locationId: string; label: string }) => void;
  setKeywordTargets: (targets: string[]) => void;
  addKeywordTarget: (keyword: string) => void;
  removeKeywordTarget: (index: number) => void;
  setTargetEntities: (entities: string[]) => void;
  addTargetEntity: (entity: string) => void;
  removeTargetEntity: (index: number) => void;
  setFaqSchemas: (faqs: FaqSchemaEntry[]) => void;
  addFaqSchema: (faq: FaqSchemaEntry) => void;
  updateFaqSchema: (index: number, faq: FaqSchemaEntry) => void;
  removeFaqSchema: (index: number) => void;
  setAuthoritativeUrls: (urls: string[]) => void;
  addAuthoritativeUrl: (url: string) => void;
  removeAuthoritativeUrl: (index: number) => void;
  setAeoBlocks: (blocks: AeoStructureBlock[]) => void;
  updateAeoBlock: (id: string, patch: Partial<AeoStructureBlock>) => void;
  setSeoTitle: (seoTitle: string) => void;
  setMetaDescription: (metaDescription: string) => void;
  setPublishing: (isPublishing: boolean) => void;
  setPublishError: (error: string | null) => void;
  hydrateFromParams: (params: {
    clusters?: string[];
    sourceRoute?: string | null;
    title?: string;
    keywords?: string[];
  }) => void;
  hydrateFromVisibilityGap: (gap: VisibilityGapHydration) => void;
  mergeAeoExtract: (extract: AeoExtractResult) => void;
  setExtractingAeo: (isExtracting: boolean) => void;
  setAutoGenerating: (isAutoGenerating: boolean) => void;
  hydrateFromAutoGenerate: (payload: {
    promptId: string;
    result: AutoGenerateGapArticle;
  }) => void;
  hydrateFromGapDraft: (payload: {
    metadata: GapArticleMetadata;
    editorContent: string;
    linkedPromptId: string | null;
    draftHistoryId: string;
  }) => void;
  setGapDraftHistoryId: (id: string | null) => void;
  setSavingGapDraft: (isSaving: boolean) => void;
  setGapDraftSaveStatus: (status: GapAnalysisUiState['gapDraftSaveStatus']) => void;
  markGapDraftUnsaved: () => void;
};

export type GapAnalysisStore = GapAnalysisUiState & GapAnalysisActions;

const initialState: GapAnalysisUiState = {
  editorContent: '',
  metadata: createDefaultGapMetadata(),
  isPublishing: false,
  publishError: null,
  sourceClusters: [],
  sourceRoute: null,
  linkedPromptId: null,
  isExtractingAeo: false,
  isAutoGenerating: false,
  gapDraftHistoryId: null,
  isSavingGapDraft: false,
  gapDraftSaveStatus: 'idle',
};

export const useGapAnalysisStore = create<GapAnalysisStore>((set, get) => ({
  ...initialState,

  reset: input => {
    set({
      editorContent: '',
      metadata: createDefaultGapMetadata({
        title: input?.title,
        cluster: input?.cluster ?? input?.sourceClusters?.[0] ?? '',
        geo: input?.geo,
        keywordTargets: input?.keywordTargets,
      }),
      isPublishing: false,
      publishError: null,
      sourceClusters: input?.sourceClusters ?? [],
      sourceRoute: input?.sourceRoute ?? null,
      linkedPromptId: null,
      isExtractingAeo: false,
      isAutoGenerating: false,
      gapDraftHistoryId: null,
      isSavingGapDraft: false,
      gapDraftSaveStatus: 'idle',
    });
  },

  setEditorContent: content =>
    set(state => ({
      editorContent: content,
      gapDraftSaveStatus:
        state.gapDraftSaveStatus === 'idle' ? state.gapDraftSaveStatus : 'unsaved',
    })),

  setMetadata: metadata => set({ metadata }),

  patchMetadata: patch =>
    set(state => ({
      metadata: { ...state.metadata, ...patch },
      gapDraftSaveStatus:
        state.gapDraftSaveStatus === 'idle' ? state.gapDraftSaveStatus : 'unsaved',
    })),

  setTitle: title =>
    set(state => ({
      metadata: { ...state.metadata, title },
    })),

  setCluster: cluster =>
    set(state => ({
      metadata: { ...state.metadata, cluster },
    })),

  setGeo: geo =>
    set(state => ({
      metadata: { ...state.metadata, geo },
    })),

  setKeywordTargets: keywordTargets =>
    set(state => ({
      metadata: { ...state.metadata, keywordTargets },
    })),

  addKeywordTarget: keyword => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    const { metadata } = get();
    if (metadata.keywordTargets.includes(trimmed)) return;
    set({
      metadata: {
        ...metadata,
        keywordTargets: [...metadata.keywordTargets, trimmed],
      },
    });
  },

  removeKeywordTarget: index =>
    set(state => ({
      metadata: {
        ...state.metadata,
        keywordTargets: state.metadata.keywordTargets.filter((_, i) => i !== index),
      },
    })),

  setTargetEntities: targetEntities =>
    set(state => ({
      metadata: { ...state.metadata, targetEntities },
    })),

  addTargetEntity: entity => {
    const trimmed = entity.trim();
    if (!trimmed) return;
    const { metadata } = get();
    if (metadata.targetEntities.includes(trimmed)) return;
    set({
      metadata: {
        ...metadata,
        targetEntities: [...metadata.targetEntities, trimmed],
      },
    });
  },

  removeTargetEntity: index =>
    set(state => ({
      metadata: {
        ...state.metadata,
        targetEntities: state.metadata.targetEntities.filter((_, i) => i !== index),
      },
    })),

  setFaqSchemas: faqSchemas =>
    set(state => ({
      metadata: { ...state.metadata, faqSchemas },
    })),

  addFaqSchema: faq =>
    set(state => ({
      metadata: {
        ...state.metadata,
        faqSchemas: [...state.metadata.faqSchemas, faq],
      },
    })),

  updateFaqSchema: (index, faq) =>
    set(state => ({
      metadata: {
        ...state.metadata,
        faqSchemas: state.metadata.faqSchemas.map((item, i) => (i === index ? faq : item)),
      },
    })),

  removeFaqSchema: index =>
    set(state => ({
      metadata: {
        ...state.metadata,
        faqSchemas: state.metadata.faqSchemas.filter((_, i) => i !== index),
      },
    })),

  setAuthoritativeUrls: authoritativeUrls =>
    set(state => ({
      metadata: { ...state.metadata, authoritativeUrls },
    })),

  addAuthoritativeUrl: url => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      return;
    }
    const { metadata } = get();
    if (metadata.authoritativeUrls.includes(trimmed)) return;
    set({
      metadata: {
        ...metadata,
        authoritativeUrls: [...metadata.authoritativeUrls, trimmed],
      },
    });
  },

  removeAuthoritativeUrl: index =>
    set(state => ({
      metadata: {
        ...state.metadata,
        authoritativeUrls: state.metadata.authoritativeUrls.filter((_, i) => i !== index),
      },
    })),

  setAeoBlocks: aeoBlocks =>
    set(state => ({
      metadata: { ...state.metadata, aeoBlocks },
    })),

  updateAeoBlock: (id, patch) =>
    set(state => ({
      metadata: {
        ...state.metadata,
        aeoBlocks: state.metadata.aeoBlocks.map(block =>
          block.id === id ? { ...block, ...patch } : block
        ),
      },
    })),

  setSeoTitle: seoTitle =>
    set(state => ({
      metadata: { ...state.metadata, seoTitle },
    })),

  setMetaDescription: metaDescription =>
    set(state => ({
      metadata: { ...state.metadata, metaDescription },
    })),

  setPublishing: isPublishing => set({ isPublishing }),

  setPublishError: publishError => set({ publishError }),

  hydrateFromParams: params => {
    const clusters = params.clusters ?? [];
    const primaryCluster = clusters[0] ?? '';
    set(state => ({
      sourceClusters: clusters,
      sourceRoute: params.sourceRoute ?? null,
      metadata: {
        ...state.metadata,
        title: params.title ?? state.metadata.title,
        cluster: primaryCluster || state.metadata.cluster,
        keywordTargets:
          params.keywords && params.keywords.length > 0
            ? params.keywords
            : state.metadata.keywordTargets,
      },
    }));
  },

  hydrateFromVisibilityGap: gap => {
    set({
      editorContent: '',
      linkedPromptId: gap.promptId,
      sourceRoute: gap.sourceRoute,
      sourceClusters: gap.promptCluster ? [gap.promptCluster] : [],
      isPublishing: false,
      publishError: null,
      isExtractingAeo: false,
      isAutoGenerating: false,
      gapDraftHistoryId: null,
      isSavingGapDraft: false,
      gapDraftSaveStatus: 'unsaved',
      metadata: {
        ...createDefaultGapMetadata({
          title: gap.title,
          cluster: gap.promptCluster,
          geo: gap.geo,
          keywordTargets: gap.keywordTargets,
        }),
        title: gap.title,
        seoTitle: gap.seoTitle,
        cluster: gap.promptCluster,
        geo: gap.geo,
        keywordTargets: gap.keywordTargets,
        targetEntities: gap.targetEntities,
      },
    });
  },

  mergeAeoExtract: extract =>
    set(state => {
      const mergedUrls = Array.from(
        new Set([...state.metadata.authoritativeUrls, ...extract.authoritativeUrls])
      );
      return {
        metadata: {
          ...state.metadata,
          metaDescription: extract.metaDescription,
          seoTitle: extract.seoTitle,
          faqSchemas: extract.faqSchemas,
          authoritativeUrls: mergedUrls,
          cluster: state.metadata.cluster,
          geo: state.metadata.geo,
          targetEntities: state.metadata.targetEntities,
          keywordTargets: state.metadata.keywordTargets,
        },
        gapDraftSaveStatus:
          state.gapDraftSaveStatus === 'idle' ? state.gapDraftSaveStatus : 'unsaved',
      };
    }),

  setExtractingAeo: isExtractingAeo => set({ isExtractingAeo }),

  setAutoGenerating: isAutoGenerating => set({ isAutoGenerating }),

  hydrateFromAutoGenerate: ({ promptId, result }) =>
    set({
      editorContent: result.content,
      linkedPromptId: promptId,
      sourceRoute: 'ai-visibility',
      sourceClusters: result.cluster ? [result.cluster] : [],
      isPublishing: false,
      publishError: null,
      isExtractingAeo: false,
      isAutoGenerating: false,
      gapDraftHistoryId: null,
      isSavingGapDraft: false,
      gapDraftSaveStatus: 'unsaved',
      metadata: {
        title: result.title,
        seoTitle: result.seoTitle,
        metaDescription: result.metaDescription,
        cluster: result.cluster,
        geo: result.geo,
        keywordTargets: result.keywordTargets,
        targetEntities: result.targetEntities,
        authoritativeUrls: result.authoritativeUrls,
        faqSchemas: result.faqSchemas,
        aeoBlocks: [
          {
            id: 'summary',
            type: 'summary',
            heading: 'Executive Summary',
            body: result.aeoBlocks.executiveSummary,
          },
          {
            id: 'entity-spotlight',
            type: 'entity-spotlight',
            heading: 'Entity Spotlight',
            body: result.aeoBlocks.entitySpotlight,
          },
        ],
      },
    }),

  hydrateFromGapDraft: payload =>
    set({
      editorContent: payload.editorContent,
      metadata: payload.metadata,
      linkedPromptId: payload.linkedPromptId,
      sourceRoute: 'ai-visibility',
      sourceClusters: payload.metadata.cluster ? [payload.metadata.cluster] : [],
      gapDraftHistoryId: payload.draftHistoryId,
      gapDraftSaveStatus: 'saved',
      isSavingGapDraft: false,
      publishError: null,
    }),

  setGapDraftHistoryId: gapDraftHistoryId => set({ gapDraftHistoryId }),

  setSavingGapDraft: isSavingGapDraft => set({ isSavingGapDraft }),

  setGapDraftSaveStatus: gapDraftSaveStatus => set({ gapDraftSaveStatus }),

  markGapDraftUnsaved: () =>
    set(state => ({
      gapDraftSaveStatus: state.gapDraftSaveStatus === 'idle' ? 'idle' : 'unsaved',
    })),
}));

/** Live manifest preview derived from metadata + editor state (client-only) */
export function buildLiveManifestPreview(input: {
  metadata: GapArticleMetadata;
  editorContent: string;
  website?: string;
  brandName?: string;
}): Record<string, unknown> {
  const { metadata, editorContent, website, brandName } = input;
  const canonicalWebsite = website ?? 'https://example.com';

  return {
    spec: 'https://ai-domain-data.org/spec/v0.1',
    draft: {
      title: metadata.title,
      seoTitle: metadata.seoTitle,
      metaDescription: metadata.metaDescription,
      cluster: metadata.cluster,
      geo: metadata.geo,
      targetEntities: metadata.targetEntities,
      keywordTargets: metadata.keywordTargets,
      authoritativeUrls: metadata.authoritativeUrls,
      faqCount: metadata.faqSchemas.length,
      aeoBlockCount: metadata.aeoBlocks.length,
      contentLength: editorContent.length,
    },
    articleJsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: metadata.seoTitle || metadata.title,
      description: metadata.metaDescription,
      about: metadata.targetEntities.map(entity => ({
        '@type': 'Thing',
        name: entity,
      })),
      keywords: metadata.keywordTargets.join(', '),
    },
    faqJsonLd:
      metadata.faqSchemas.length > 0
        ? {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: metadata.faqSchemas.map(faq => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
              },
            })),
          }
        : null,
    domainReference: {
      name: brandName ?? metadata.title,
      website: canonicalWebsite,
      entity_type: 'Organization',
    },
  };
}
