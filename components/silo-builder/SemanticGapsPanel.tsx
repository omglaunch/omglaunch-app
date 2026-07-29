'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { SemanticGap } from '@/lib/silo-builder/semantic-gaps';
import type { SiloNodeDto } from '@/lib/silo-builder/types';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

type SemanticGapsPanelProps = {
  gaps: SemanticGap[];
  projectId: string;
  existingSpokes: SiloNodeDto[];
  onSpokeCreated: (node: SiloNodeDto) => void;
};

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

export default function SemanticGapsPanel({
  gaps,
  projectId,
  existingSpokes,
  onSpokeCreated,
}: SemanticGapsPanelProps) {
  const [creatingTopic, setCreatingTopic] = useState<string | null>(null);

  const existingSpokeLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const spoke of existingSpokes) {
      labels.add(normalizeLabel(spoke.title));
      if (spoke.targetKeyword?.trim()) {
        labels.add(normalizeLabel(spoke.targetKeyword));
      }
    }
    return labels;
  }, [existingSpokes]);

  if (!gaps.length) {
    return null;
  }

  async function handleCreateSpoke(gap: SemanticGap) {
    if (creatingTopic) {
      return;
    }

    setCreatingTopic(gap.topic);

    try {
      const response = await fetch('/api/silo-builder/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          gapTopic: gap.topic,
          gapRationale: gap.rationale,
          gapPriority: gap.priority,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Failed to create spoke from gap.';
        throw new Error(message);
      }

      const node =
        typeof payload === 'object' && payload !== null && 'node' in payload
          ? (payload.node as SiloNodeDto)
          : null;

      if (!node) {
        throw new Error('Spoke creation returned invalid data.');
      }

      onSpokeCreated(node);
      toast.success(`Spoke "${node.title}" added to your silo.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create spoke from gap.');
    } finally {
      setCreatingTopic(null);
    }
  }

  return (
    <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-background to-background shadow-sm dark:border-amber-900/40 dark:from-amber-950/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <CardTitle className="text-base">Semantic Gaps Detected</CardTitle>
            <CardDescription>
              High-value sub-topics your competitor is missing — turn each into a spoke with one
              click.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {gaps.map(gap => {
          const alreadyCreated = existingSpokeLabels.has(normalizeLabel(gap.topic));
          const isCreating = creatingTopic === gap.topic;

          return (
            <div
              key={gap.topic}
              className="flex h-full flex-col rounded-lg border border-border bg-card/80 p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-medium text-foreground">{gap.topic}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    'shrink-0 text-[10px] uppercase',
                    gap.priority === 'high' &&
                      'border-red-300 text-red-700 dark:border-red-800 dark:text-red-300',
                    gap.priority === 'medium' &&
                      'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300',
                    gap.priority === 'low' &&
                      'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                  )}
                >
                  {gap.priority}
                </Badge>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                {gap.rationale}
              </p>
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={alreadyCreated || isCreating || Boolean(creatingTopic)}
                  onClick={() => void handleCreateSpoke(gap)}
                  className="w-full gap-2 border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40"
                >
                  {isCreating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {alreadyCreated ? 'Spoke created' : 'Create spoke'}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
