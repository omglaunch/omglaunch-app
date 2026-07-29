'use client';

import { generateNamedEntitySchema } from '@/app/actions/semantic-analysis';
import { Check, Copy, Loader2, Plus, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import type { NamedEntitiesResult, NamedEntityCategory } from '@/lib/semantic-metrics';
import { cn } from '@/lib/utils';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

type NamedEntitiesTabProps = {
  data: NamedEntitiesResult | null;
  targetUrl: string;
  targetKeyword: string;
  isLoading: boolean;
  loadingStage?: string | null;
  error?: string | null;
};

type GraphNode = {
  id: string;
  name: string;
  val: number;
  category: NamedEntityCategory;
  salience: number;
  description: string;
  x?: number;
  y?: number;
};

type GraphLink = {
  source: string;
  target: string;
  label: string;
};

const CATEGORY_COLORS: Record<NamedEntityCategory, string> = {
  Person: '#6366F1',
  Organization: '#38BDF8',
  Location: '#22C55E',
  Product: '#F97316',
  Concept: '#EC4899',
};

const CATEGORY_BADGE_CLASSES: Record<NamedEntityCategory, string> = {
  Person: 'bg-indigo-100 text-indigo-800',
  Organization: 'bg-sky-100 text-sky-800',
  Location: 'bg-green-100 text-green-800',
  Product: 'bg-orange-100 text-orange-800',
  Concept: 'bg-pink-100 text-pink-800',
};

function formatSalience(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSourceLabel(url: string): string {
  if (!url) return '—';

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '🔗';
  }
}

function EntitySourceLink({ entity }: { entity: { sourceUrl: string; sourceUrls: string[] } }) {
  if (!entity.sourceUrl) {
    return <span className="text-muted-foreground">—</span>;
  }

  const extraSources = entity.sourceUrls.filter(url => url && url !== entity.sourceUrl);

  return (
    <div className="inline-flex items-center gap-1.5">
      <a
        href={entity.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 hover:underline dark:text-blue-600 dark:hover:text-blue-700"
        title={entity.sourceUrl}
      >
        <span aria-hidden>🔗</span>
        <span>{formatSourceLabel(entity.sourceUrl)}</span>
      </a>
      {extraSources.length > 0 ? (
        <span
          className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          title={entity.sourceUrls.join('\n')}
        >
          +{extraSources.length}
        </span>
      ) : null}
    </div>
  );
}

function buildGraphData(data: NamedEntitiesResult): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = data.entities.map(entity => ({
    id: entity.entityName,
    name: entity.entityName,
    val: Math.max(4, entity.salience * 24),
    category: entity.category,
    salience: entity.salience,
    description: entity.description,
  }));

  const nodeIds = new Set(nodes.map(node => node.id));
  const links: GraphLink[] = data.relationships.filter(
    link => nodeIds.has(link.source) && nodeIds.has(link.target)
  );

  return { nodes, links };
}

type GraphTooltipProps = {
  node: GraphNode;
  x: number;
  y: number;
};

function GraphTooltip({ node, x, y }: GraphTooltipProps) {
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[160px] -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
      style={{ left: x, top: y - 8 }}
    >
      <p className="text-sm font-semibold text-foreground">{node.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-medium">Category:</span> {node.category}
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium">Salience:</span> {formatSalience(node.salience)}
      </p>
    </div>
  );
}

type EntityGraphProps = {
  data: NamedEntitiesResult;
  selectedEntityId: string | null;
  graphRef: React.MutableRefObject<ForceGraphMethods | undefined>;
  onNodeSelect: (node: GraphNode) => void;
};

function EntityGraph({ data, selectedEntityId, graphRef, onNodeSelect }: EntityGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 760, height: 360 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const hoveredNodeRef = useRef<GraphNode | null>(null);

  const graphData = useMemo(() => buildGraphData(data), [data]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 760;
      setDimensions({ width: Math.max(320, width), height: 360 });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const updateTooltipPosition = useCallback(
    (node: GraphNode) => {
      if (
        !graphRef.current ||
        typeof node.x !== 'number' ||
        typeof node.y !== 'number'
      ) {
        return;
      }

      const coords = graphRef.current.graph2ScreenCoords(node.x, node.y);
      setTooltipPos({ x: coords.x, y: coords.y });
      setHoveredNode(node);
      hoveredNodeRef.current = node;
    },
    [graphRef]
  );

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/60 text-sm text-muted-foreground">
        No entities available for the relationship graph.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl border border-border bg-muted"
    >
      {hoveredNode ? <GraphTooltip node={hoveredNode} x={tooltipPos.x} y={tooltipPos.y} /> : null}
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeVal="val"
        nodeColor={node => {
          const graphNode = node as GraphNode;
          if (graphNode.id === selectedEntityId) {
            return '#1d4ed8';
          }
          return CATEGORY_COLORS[graphNode.category];
        }}
        nodeRelSize={6}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const graphNode = node as GraphNode;
          const label = graphNode.name.length > 18 ? `${graphNode.name.slice(0, 16)}…` : graphNode.name;
          const fontSize = Math.max(10 / globalScale, 3);
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = graphNode.id === selectedEntityId ? '#1e3a8a' : '#334155';
          ctx.fillText(label, graphNode.x ?? 0, (graphNode.y ?? 0) + graphNode.val / globalScale + 2);
        }}
        nodeCanvasObjectMode={() => 'after'}
        linkLabel="label"
        linkWidth={1.25}
        linkCurvature={0.18}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={0.92}
        linkDirectionalArrowColor={() => 'rgba(71, 85, 105, 0.75)'}
        linkColor={() => 'rgba(100, 116, 139, 0.55)'}
        backgroundColor="#f8fafc"
        cooldownTicks={100}
        enableNodeDrag
        onNodeClick={node => onNodeSelect(node as GraphNode)}
        onNodeHover={node => {
          document.body.style.cursor = node ? 'pointer' : 'default';
          if (node) {
            updateTooltipPosition(node as GraphNode);
          } else {
            setHoveredNode(null);
            hoveredNodeRef.current = null;
          }
        }}
        onEngineTick={() => {
          if (hoveredNodeRef.current) {
            updateTooltipPosition(hoveredNodeRef.current);
          }
        }}
      />
    </div>
  );
}

export default function NamedEntitiesTab({
  data,
  targetUrl,
  targetKeyword,
  isLoading,
  loadingStage,
  error,
}: NamedEntitiesTabProps) {
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [schemaBlock, setSchemaBlock] = useState('');
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);
  const [contentDraft, setContentDraft] = useState<string[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [recentlyAddedEntity, setRecentlyAddedEntity] = useState<string | null>(null);

  const graphRef = useRef<ForceGraphMethods>();
  const entityRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const inventorySectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContentDraft([]);
    setSchemaBlock('');
    setSchemaError(null);
    setSelectedEntityId(null);
  }, [data]);

  const addEntityToContent = useCallback((entityName: string) => {
    setContentDraft(previous => {
      if (previous.includes(entityName)) {
        return previous;
      }
      return [...previous, entityName];
    });
    setRecentlyAddedEntity(entityName);
    window.setTimeout(() => setRecentlyAddedEntity(null), 1500);
  }, []);

  const handleNodeSelect = useCallback((node: GraphNode) => {
    setSelectedEntityId(node.id);

    if (typeof node.x === 'number' && typeof node.y === 'number') {
      graphRef.current?.centerAt(node.x, node.y, 800);
      graphRef.current?.zoom(2.4, 800);
    }

    window.requestAnimationFrame(() => {
      const row = entityRowRefs.current.get(node.id);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        inventorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, []);

  const handleGenerateSchema = async () => {
    if (!data?.entities.length) return;

    setIsGeneratingSchema(true);
    setSchemaError(null);

    try {
      const result = await generateNamedEntitySchema(data.entities, targetUrl, targetKeyword);
      if (result.error) {
        setSchemaError(result.error);
      }
      if (result.schema) {
        setSchemaBlock(result.schema);
      }
    } catch {
      setSchemaError('Failed to generate schema markup. Please try again.');
    } finally {
      setIsGeneratingSchema(false);
    }
  };

  const handleCopySchema = async () => {
    if (!schemaBlock) return;

    try {
      await navigator.clipboard.writeText(schemaBlock);
      setCopiedSchema(true);
      window.setTimeout(() => setCopiedSchema(false), 2000);
    } catch {
      // Ignore clipboard errors.
    }
  };

  const handleCopyDraft = async () => {
    if (contentDraft.length === 0) return;

    const draftText = contentDraft.map(entity => `- ${entity}`).join('\n');

    try {
      await navigator.clipboard.writeText(draftText);
    } catch {
      // Ignore clipboard errors.
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card px-6 py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-blue-600" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">Analyzing named entities…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {loadingStage ?? 'Fetching competitor SERP content and running Gemini NER…'}
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/60 px-6 py-16 text-center">
        <Sparkles className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Named entities will appear here after analysis completes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm leading-relaxed text-emerald-900 dark:border-blue-100 dark:bg-blue-50/60 dark:text-blue-900">
        <p className="font-medium">Tip: Use Competitive Gap as your content brief</p>
        <p className="mt-1 text-emerald-800/90 dark:text-blue-800/90">
          Entities competitors mention—but your page does not—signal topical gaps. Click{' '}
          <strong>Add</strong> on any gap entity to queue it in your Content Draft, then weave those
          topics into new sections to strengthen topical authority for &apos;{targetKeyword}&apos;.
        </p>
      </div>

      {contentDraft.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Content Draft</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Entities queued for your next content update.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyDraft}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy draft
            </button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {contentDraft.map(entityName => (
              <li
                key={entityName}
                className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
              >
                {entityName}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section ref={inventorySectionRef} className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Entity Inventory</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Named entities extracted from top-ranking competitor content for &apos;{targetKeyword}
            &apos;. Click a graph node to jump to its row.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/80">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Entity Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Source
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Salience Score
                </th>
              </tr>
            </thead>
            <tbody>
              {data.entities.map((entity, index) => (
                <tr
                  key={`${entity.entityName}-${index}`}
                  ref={element => {
                    if (element) {
                      entityRowRefs.current.set(entity.entityName, element);
                    } else {
                      entityRowRefs.current.delete(entity.entityName);
                    }
                  }}
                  className={cn(
                    'border-b border-border last:border-b-0 transition-colors duration-300',
                    index % 2 === 1 && 'bg-muted',
                    selectedEntityId === entity.entityName &&
                      'bg-emerald-50 ring-2 ring-inset ring-emerald-300 dark:bg-blue-50 dark:ring-blue-300'
                  )}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{entity.entityName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                        CATEGORY_BADGE_CLASSES[entity.category]
                      )}
                    >
                      {entity.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <EntitySourceLink entity={entity} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatSalience(entity.salience)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Relationship Graph</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Hover for details. Click a node to focus the graph and highlight its inventory row.
          </p>
        </div>
        <EntityGraph
          data={data}
          selectedEntityId={selectedEntityId}
          graphRef={graphRef}
          onNodeSelect={handleNodeSelect}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Competitive Gap</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Entities found on competitor pages that are missing from your page.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your Page
            </h4>
            <p className="mt-1 truncate text-sm text-foreground">{targetUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.userPageEntities.length > 0 ? (
                data.userPageEntities.map(entity => (
                  <span
                    key={entity.entityName}
                    className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-blue-100 dark:text-blue-800"
                  >
                    {entity.entityName}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No entities detected on your page.</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-orange-700">
              Competitor Gap
            </h4>
            <p className="mt-1 text-sm text-orange-900">
              {data.competitorOnlyEntities.length} entit
              {data.competitorOnlyEntities.length === 1 ? 'y' : 'ies'} missing from your page
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.competitorOnlyEntities.length > 0 ? (
                data.competitorOnlyEntities.map(entity => {
                  const isInDraft = contentDraft.includes(entity.entityName);
                  const wasJustAdded = recentlyAddedEntity === entity.entityName;

                  return (
                    <span
                      key={entity.entityName}
                      className="inline-flex items-center gap-1 rounded-full bg-orange-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-orange-800"
                      title={entity.description}
                    >
                      {entity.entityName}
                      <button
                        type="button"
                        onClick={() => addEntityToContent(entity.entityName)}
                        disabled={isInDraft}
                        aria-label={`Add ${entity.entityName} to content draft`}
                        className={cn(
                          'inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors',
                          isInDraft
                            ? 'bg-emerald-200 text-emerald-800'
                            : 'bg-orange-200 text-orange-900 hover:bg-orange-300',
                          wasJustAdded && 'scale-110'
                        )}
                      >
                        {isInDraft ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      </button>
                    </span>
                  );
                })
              ) : (
                <span className="text-sm text-muted-foreground">
                  Your page covers all major competitor entities.
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Schema Action</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Gemini assigns specific Schema.org types and sameAs links for each entity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerateSchema}
              disabled={isGeneratingSchema || data.entities.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {isGeneratingSchema ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Auto-Generate Schema
            </button>
            {schemaBlock ? (
              <button
                type="button"
                onClick={handleCopySchema}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {copiedSchema ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy JSON-LD
              </button>
            ) : null}
          </div>
        </div>

        {schemaError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {schemaError}
          </div>
        ) : null}

        {schemaBlock ? (
          <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
            {schemaBlock}
          </pre>
        ) : null}
      </section>
    </div>
  );
}
