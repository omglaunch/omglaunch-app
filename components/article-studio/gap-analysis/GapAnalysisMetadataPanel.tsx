'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGapAnalysisStore } from '@/lib/article-studio/gap-analysis-store';
import { cn } from '@/lib/utils';

type TagListEditorProps = {
  label: string;
  items: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
};

function TagListEditor({ label, items, placeholder, onAdd, onRemove }: TagListEditorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <form
        className="flex gap-2"
        onSubmit={event => {
          event.preventDefault();
          const form = event.currentTarget;
          const input = form.elements.namedItem('tag-input') as HTMLInputElement;
          onAdd(input.value);
          input.value = '';
        }}
      >
        <Input name="tag-input" placeholder={placeholder} className="h-9 text-sm" />
        <Button type="submit" size="sm" variant="outline" className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </form>
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs"
            >
              <span>{item}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">None added yet.</p>
      )}
    </div>
  );
}

export default function GapAnalysisMetadataPanel({ className }: { className?: string }) {
  const metadata = useGapAnalysisStore(state => state.metadata);
  const patchMetadata = useGapAnalysisStore(state => state.patchMetadata);
  const addKeywordTarget = useGapAnalysisStore(state => state.addKeywordTarget);
  const removeKeywordTarget = useGapAnalysisStore(state => state.removeKeywordTarget);
  const addTargetEntity = useGapAnalysisStore(state => state.addTargetEntity);
  const removeTargetEntity = useGapAnalysisStore(state => state.removeTargetEntity);
  const addAuthoritativeUrl = useGapAnalysisStore(state => state.addAuthoritativeUrl);
  const removeAuthoritativeUrl = useGapAnalysisStore(state => state.removeAuthoritativeUrl);
  const addFaqSchema = useGapAnalysisStore(state => state.addFaqSchema);
  const updateFaqSchema = useGapAnalysisStore(state => state.updateFaqSchema);
  const removeFaqSchema = useGapAnalysisStore(state => state.removeFaqSchema);
  const updateAeoBlock = useGapAnalysisStore(state => state.updateAeoBlock);

  return (
    <div className={cn('space-y-5', className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="gap-title" className="text-xs uppercase tracking-wide text-muted-foreground">
            Title
          </Label>
          <Input
            id="gap-title"
            value={metadata.title}
            onChange={event => patchMetadata({ title: event.target.value })}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gap-cluster" className="text-xs uppercase tracking-wide text-muted-foreground">
            Cluster
          </Label>
          <Input
            id="gap-cluster"
            value={metadata.cluster}
            onChange={event => patchMetadata({ cluster: event.target.value })}
            className="h-9"
            placeholder="e.g. Local SEO"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="gap-seo-title" className="text-xs uppercase tracking-wide text-muted-foreground">
            SEO Title
          </Label>
          <Input
            id="gap-seo-title"
            value={metadata.seoTitle}
            onChange={event => patchMetadata({ seoTitle: event.target.value })}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gap-geo" className="text-xs uppercase tracking-wide text-muted-foreground">
            Geo Target
          </Label>
          <Input
            id="gap-geo"
            value={metadata.geo.label}
            onChange={event =>
              patchMetadata({
                geo: { ...metadata.geo, label: event.target.value },
              })
            }
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gap-meta" className="text-xs uppercase tracking-wide text-muted-foreground">
          Meta Description
        </Label>
        <Textarea
          id="gap-meta"
          value={metadata.metaDescription}
          onChange={event => patchMetadata({ metaDescription: event.target.value })}
          rows={2}
          className="resize-y text-sm"
        />
      </div>

      <TagListEditor
        label="Keyword Targets"
        items={metadata.keywordTargets}
        placeholder="Add keyword target…"
        onAdd={addKeywordTarget}
        onRemove={removeKeywordTarget}
      />

      <TagListEditor
        label="Target Entities"
        items={metadata.targetEntities}
        placeholder="Add entity (brand, product, person)…"
        onAdd={addTargetEntity}
        onRemove={removeTargetEntity}
      />

      <TagListEditor
        label="Authoritative URLs"
        items={metadata.authoritativeUrls}
        placeholder="https://…"
        onAdd={addAuthoritativeUrl}
        onRemove={removeAuthoritativeUrl}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            FAQ Schemas
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => addFaqSchema({ question: '', answer: '' })}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add FAQ
          </Button>
        </div>
        {metadata.faqSchemas.length === 0 ? (
          <p className="text-xs text-muted-foreground">No FAQ schema entries yet.</p>
        ) : (
          <div className="space-y-3">
            {metadata.faqSchemas.map((faq, index) => (
              <div
                key={`faq-${index}`}
                className="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">FAQ #{index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500"
                    onClick={() => removeFaqSchema(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  value={faq.question}
                  onChange={event =>
                    updateFaqSchema(index, { ...faq, question: event.target.value })
                  }
                  placeholder="Question"
                  className="h-9 text-sm"
                />
                <Textarea
                  value={faq.answer}
                  onChange={event =>
                    updateFaqSchema(index, { ...faq, answer: event.target.value })
                  }
                  placeholder="Answer (1–2 sentences for AEO)"
                  rows={2}
                  className="resize-y text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          AEO Structure Blocks
        </Label>
        {metadata.aeoBlocks.map(block => (
          <div key={block.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
            <Input
              value={block.heading}
              onChange={event => updateAeoBlock(block.id, { heading: event.target.value })}
              className="h-9 text-sm font-medium"
            />
            <Textarea
              value={block.body}
              onChange={event => updateAeoBlock(block.id, { body: event.target.value })}
              rows={3}
              className="resize-y text-sm"
              placeholder={`Content for ${block.type} block…`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
