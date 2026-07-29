'use client';

import { Layers } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { HubGroup } from '@/lib/silo-builder/hub-groups';
import { cn } from '@/lib/utils';

type HubGroupsPanelProps = {
  hubGroups: HubGroup[];
  onSpokeTitleClick: (title: string) => void;
};

export default function HubGroupsPanel({
  hubGroups,
  onSpokeTitleClick,
}: HubGroupsPanelProps) {
  if (!hubGroups.length) {
    return null;
  }

  return (
    <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-background to-background shadow-sm dark:border-violet-900/40 dark:from-violet-950/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 shrink-0 text-emerald-600 dark:text-violet-400" />
          <div>
            <CardTitle className="text-base">Hub Theme Groups</CardTitle>
            <CardDescription>
              Gemini grouped your attack spokes into {hubGroups.length} hub themes — click a spoke
              to jump to it in the grid.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {hubGroups.map((group, index) => (
            <AccordionItem key={`${group.hubTitle}-${index}`} value={`hub-${index}`}>
              <AccordionTrigger className="text-left hover:no-underline">
                <div className="min-w-0 pr-2">
                  <p className="font-medium text-foreground">{group.hubTitle}</p>
                  <p className="text-xs font-normal text-muted-foreground">
                    {group.hubKeyword} · {group.spokeTitles.length} spoke
                    {group.spokeTitles.length === 1 ? '' : 's'}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2 pt-1">
                  {group.spokeTitles.map(title => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => onSpokeTitleClick(title)}
                      className={cn(
                        'rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-medium text-emerald-800 transition-colors',
                        'hover:border-emerald-300 hover:bg-emerald-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60'
                      )}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
