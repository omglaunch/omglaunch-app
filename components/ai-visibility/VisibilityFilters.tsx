'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type {
  ChatGptMode,
  CitationStatusFilter,
  DeviceEnvironment,
  EngineFilter,
  VisibilityFiltersState,
} from '@/lib/ai-visibility/types';

type Props = {
  filters: VisibilityFiltersState;
  clusters: string[];
  geos: string[];
  onChange: (patch: Partial<VisibilityFiltersState>) => void;
  onChatGptModeAttempt: (mode: ChatGptMode) => void;
  ragDimmed: boolean;
};

const segmentClass =
  'h-9 gap-0 rounded-lg border border-zinc-200 bg-slate-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900';
const itemClass =
  'h-8 rounded-md px-2.5 text-xs data-[state=on]:bg-white data-[state=on]:text-emerald-700 data-[state=on]:shadow-sm dark:data-[state=on]:bg-zinc-800 dark:data-[state=on]:text-emerald-300';

export default function VisibilityFilters({
  filters,
  clusters,
  geos,
  onChange,
  onChatGptModeAttempt,
  ragDimmed,
}: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Search prompts…"
            className="h-10 border-zinc-200 bg-slate-50 pl-9 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>
        <Select
          value={filters.promptCluster}
          onValueChange={(v) => onChange({ promptCluster: v })}
        >
          <SelectTrigger className="h-10 w-full border-zinc-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 lg:w-[220px]">
            <SelectValue placeholder="Prompt Cluster" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Prompt Clusters</SelectItem>
            {clusters.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <ToggleGroup
            type="single"
            value={filters.engine}
            onValueChange={(v) => {
              if (!v) return;
              onChange({ engine: v as EngineFilter });
            }}
            className={segmentClass}
          >
            {(
              [
                ['all', 'All Engines'],
                ['google_aio', 'Google AIO'],
                ['perplexity', 'Perplexity'],
                ['chatgpt', 'ChatGPT'],
                ['claude', 'Claude'],
              ] as const
            ).map(([value, label]) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className={itemClass}
                aria-label={label}
              >
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <ToggleGroup
            type="single"
            value={filters.device}
            onValueChange={(v) => {
              if (!v) return;
              onChange({ device: v as DeviceEnvironment });
            }}
            className={segmentClass}
          >
            <ToggleGroupItem value="desktop" className={itemClass}>
              Desktop
            </ToggleGroupItem>
            <ToggleGroupItem value="mobile" className={itemClass}>
              Mobile
            </ToggleGroupItem>
          </ToggleGroup>

          <ToggleGroup
            type="single"
            value={filters.chatGptMode}
            onValueChange={(v) => {
              if (!v) return;
              onChatGptModeAttempt(v as ChatGptMode);
            }}
            className={cn(segmentClass, ragDimmed && 'ring-1 ring-amber-500/40')}
          >
            <ToggleGroupItem value="live_web" className={itemClass}>
              Live Web Search
            </ToggleGroupItem>
            <ToggleGroupItem value="base_knowledge" className={itemClass}>
              Base Knowledge
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={filters.geoTarget}
            onValueChange={(v) => onChange({ geoTarget: v })}
          >
            <SelectTrigger className="h-9 w-full border-zinc-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 sm:w-[200px]">
              <SelectValue placeholder="Intent / Geo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Geo Targets</SelectItem>
              {geos.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.citationStatus}
            onValueChange={(v) =>
              onChange({ citationStatus: v as CitationStatusFilter })
            }
          >
            <SelectTrigger className="h-9 w-full border-zinc-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 sm:w-[210px]">
              <SelectValue placeholder="Citation Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="omitted_everywhere">Omitted Everywhere</SelectItem>
              <SelectItem value="partially_omitted">Partially Omitted</SelectItem>
              <SelectItem value="sync_failed">Sync Failed</SelectItem>
              <SelectItem value="negative_context">Negative Context</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
