'use client';

import { useState } from 'react';
import { FilePlus, Loader2, Sparkles } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type QuickGenerateResult = {
  title: string;
  seoTitle: string;
  metaDescription: string;
  content: string;
  wordCount: number;
  additionalContext?: string;
};

type CreateArticleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartBlank: (title: string) => Promise<void>;
  onQuickGenerate: (input: {
    title: string;
    wordCount: number;
    additionalContext?: string;
  }) => Promise<QuickGenerateResult>;
};

const WORD_COUNT_OPTIONS = [500, 800, 1000, 1200, 1500, 2000];

export default function CreateArticleDialog({
  open,
  onOpenChange,
  onStartBlank,
  onQuickGenerate,
}: CreateArticleDialogProps) {
  const [blankTitle, setBlankTitle] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [wordCount, setWordCount] = useState('1000');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isStartingBlank, setIsStartingBlank] = useState(false);
  const [isQuickGenerating, setIsQuickGenerating] = useState(false);

  function resetForm() {
    setBlankTitle('');
    setQuickTitle('');
    setWordCount('1000');
    setAdditionalContext('');
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  async function handleStartBlank() {
    const title = blankTitle.trim();
    if (!title) {
      toast.error('Enter a title or focus keyword.');
      return;
    }

    setIsStartingBlank(true);
    try {
      await onStartBlank(title);
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create blank draft.');
    } finally {
      setIsStartingBlank(false);
    }
  }

  async function handleQuickGenerate() {
    const title = quickTitle.trim();
    if (!title) {
      toast.error('Enter a title or keyword.');
      return;
    }

    setIsQuickGenerating(true);
    try {
      await onQuickGenerate({
        title,
        wordCount: Number.parseInt(wordCount, 10),
        additionalContext: additionalContext.trim() || undefined,
      });
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Quick AI generation failed.');
    } finally {
      setIsQuickGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Article Studio Draft</DialogTitle>
          <DialogDescription>
            Start from scratch or let AI draft an article using only your inputs — no upstream brief
            required.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card shadow-sm">
                <FilePlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Start Blank Draft</h3>
                <p className="text-xs text-muted-foreground">Type or paste your own Markdown.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="blank-title">Title / Focus Keyword</Label>
                <Input
                  id="blank-title"
                  value={blankTitle}
                  onChange={event => setBlankTitle(event.target.value)}
                  placeholder="e.g. Best Hiking Boots for Tropical Trails"
                />
              </div>
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-500"
                onClick={() => void handleStartBlank()}
                disabled={isStartingBlank || isQuickGenerating}
              >
                {isStartingBlank ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FilePlus className="mr-2 h-4 w-4" />
                )}
                Start Blank Draft
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Quick AI Writer</h3>
                <p className="text-xs text-muted-foreground">Generate a structured draft instantly.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="quick-title">Title / Keyword</Label>
                <Input
                  id="quick-title"
                  value={quickTitle}
                  onChange={event => setQuickTitle(event.target.value)}
                  placeholder="e.g. How to Choose Running Shoes"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="word-count">Target Word Count</Label>
                <Select value={wordCount} onValueChange={setWordCount}>
                  <SelectTrigger id="word-count">
                    <SelectValue placeholder="Select word count" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORD_COUNT_OPTIONS.map(option => (
                      <SelectItem key={option} value={String(option)}>
                        {option.toLocaleString()} words
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-context">Additional Context / Style Guidelines (optional)</Label>
                <Textarea
                  id="quick-context"
                  value={additionalContext}
                  onChange={event => setAdditionalContext(event.target.value)}
                  placeholder="Tone, audience, must-include points, formatting preferences…"
                  rows={3}
                />
              </div>
              <Button
                type="button"
                className={cn('w-full bg-emerald-600 hover:bg-emerald-500')}
                onClick={() => void handleQuickGenerate()}
                disabled={isStartingBlank || isQuickGenerating}
              >
                {isQuickGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate with AI
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
