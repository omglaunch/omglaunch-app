'use client';

import { useEffect } from 'react';
import { Construction } from 'lucide-react';
import { useProject } from '@/components/projects/ProjectProvider';
import ToolHistoryPanel from '@/components/tool-history/ToolHistoryPanel';
import { useToolHistory } from '@/hooks/useToolHistory';
import type { ToolSlug } from '@/lib/tool-history/types';

interface Props {
  title: string;
  description: string;
  toolSlug: ToolSlug;
}

export default function PlaceholderView({ title, description, toolSlug }: Props) {
  const { activeProjectId } = useProject();
  const {
    entries,
    isLoading,
    activeId,
    remove,
    loadEntry,
    setActiveId,
  } = useToolHistory(toolSlug, {
    limit: 25,
    workspaceId: activeProjectId,
  });

  useEffect(() => {
    setActiveId(null);
  }, [activeProjectId, setActiveId]);

  return (
    <div className="min-h-full p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-24 text-center shadow-sm">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Construction size={28} className="text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-base font-semibold text-foreground">Coming Soon</h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>

        <ToolHistoryPanel
          title="Saved History"
          description="Runs for this tool are stored in your workspace as features roll out."
          entries={entries}
          activeId={activeId}
          isLoading={isLoading}
          emptyMessage="No saved runs yet. History will appear here once this tool is active."
          onLoad={entry => {
            void loadEntry(entry.id).then(() => setActiveId(entry.id));
          }}
          onDelete={id => void remove(id)}
        />
      </div>
    </div>
  );
}
