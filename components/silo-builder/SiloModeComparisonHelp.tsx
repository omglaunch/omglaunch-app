'use client';

import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  SILO_COMPETITOR_MODE_GUIDE,
  SILO_KEYWORD_MODE_GUIDE,
  type SiloModeGuideEntry,
} from '@/lib/silo-builder/mode-guide';

function ModeGuideBlock({ entry }: { entry: SiloModeGuideEntry }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{entry.title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground/80">Use when: </span>
        {entry.when}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground/80">You get: </span>
        {entry.outputs}
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">Cost: </span>
        {entry.credits} credits per run
      </p>
    </div>
  );
}

export default function SiloModeComparisonHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label="When to use keyword vs competitor mode"
        >
          <CircleHelp className="h-3.5 w-3.5" />
          Which mode?
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,22rem)] space-y-4 p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Keyword vs competitor</p>
          <p className="text-xs text-muted-foreground">
            Both tabs build a silo you can edit, brief, and generate from. Pick based on your
            starting input.
          </p>
        </div>
        <ModeGuideBlock entry={SILO_KEYWORD_MODE_GUIDE} />
        <div className="border-t border-border" />
        <ModeGuideBlock entry={SILO_COMPETITOR_MODE_GUIDE} />
      </PopoverContent>
    </Popover>
  );
}
