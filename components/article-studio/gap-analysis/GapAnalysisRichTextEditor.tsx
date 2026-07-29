'use client';

import {
  Bold,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type GapAnalysisRichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string = prefix
): { next: string; cursor: number } {
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const next = `${before}${prefix}${selected}${suffix}${after}`;
  const cursor = selectionStart + prefix.length + selected.length + suffix.length;
  return { next, cursor };
}

function prefixLines(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  linePrefix: string
): { next: string; cursor: number } {
  const before = value.slice(0, selectionStart);
  const selected = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);
  const block = selected || 'List item';
  const prefixed = block
    .split('\n')
    .map(line => `${linePrefix}${line}`)
    .join('\n');
  const next = `${before}${prefixed}${after}`;
  return { next, cursor: before.length + prefixed.length };
}

export default function GapAnalysisRichTextEditor({
  value,
  onChange,
  placeholder = 'Draft gap-filling content…',
  className,
}: GapAnalysisRichTextEditorProps) {
  function applyTransform(
    transform: (
      val: string,
      start: number,
      end: number
    ) => { next: string; cursor: number }
  ) {
    const textarea = document.getElementById('gap-analysis-editor') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const { next, cursor } = transform(value, start, end);
    onChange(next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => applyTransform((v, s, e) => wrapSelection(v, s, e, '**'))}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => applyTransform((v, s, e) => wrapSelection(v, s, e, '*'))}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => applyTransform((v, s, e) => wrapSelection(v, s, e, '## ', ''))}
          aria-label="Heading"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => applyTransform((v, s, e) => prefixLines(v, s, e, '- '))}
          aria-label="Bullet list"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => applyTransform((v, s, e) => prefixLines(v, s, e, '1. '))}
          aria-label="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => applyTransform((v, s, e) => prefixLines(v, s, e, '> '))}
          aria-label="Quote"
        >
          <Quote className="h-4 w-4" />
        </Button>
      </div>

      <textarea
        id="gap-analysis-editor"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-0 flex-1 resize-none border-0 bg-card p-4 font-mono text-sm leading-relaxed text-foreground outline-none focus:ring-0"
        spellCheck
      />
    </div>
  );
}
