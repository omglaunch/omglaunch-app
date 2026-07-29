'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  createProject,
  saveKeywords,
  type KeywordManagerProject,
  type SaveKeywordInput,
} from '@/app/actions/keyword-manager';
import { useProject } from '@/components/projects/ProjectProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { RelatedKeyword } from '@/lib/semantic-metrics';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronsUpDown,
  FolderPlus,
  Hash,
  Loader2,
  Plus,
  Tag,
  X,
} from 'lucide-react';
import { getResearchLocationLabel } from './research-locations';
import { locationCodeAbbreviation } from '@/lib/projects/display';

const RESEARCH_LANGUAGE_CODES: Record<string, string> = {
  English: 'en',
  Malay: 'ms',
  Chinese: 'zh',
  Indonesian: 'id',
  Thai: 'th',
  Vietnamese: 'vi',
};

function resolveLanguageCode(language: string): string {
  return RESEARCH_LANGUAGE_CODES[language] ?? language.toLowerCase().slice(0, 2);
}

type SaveToTrackerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRows: RelatedKeyword[];
  locationCode: number;
  language: string;
  onSaved: (result: { created: number; skipped: number; harvested?: number }) => void;
};

function ProjectCombobox({
  projects,
  value,
  onChange,
  disabled,
}: {
  projects: KeywordManagerProject[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = projects.find(project => project.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? selected.name : 'Select a project…'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects…" />
          <CommandList>
            <CommandEmpty>No projects found.</CommandEmpty>
            <CommandGroup>
              {projects.map(project => (
                <CommandItem
                  key={project.id}
                  value={`${project.name} ${project.domain ?? ''}`}
                  onSelect={() => {
                    onChange(project.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === project.id ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{project.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[project.domain, locationCodeAbbreviation(project.locationCode)]
                        .filter(Boolean)
                        .join(' · ') || 'No domain set'}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function SaveToTrackerModal({
  open,
  onOpenChange,
  selectedRows,
  locationCode,
  language,
  onSaved,
}: SaveToTrackerModalProps) {
  const {
    projects,
    activeProjectId,
    refreshProjects,
    isLoading: isLoadingProjectsContext,
  } = useProject();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isRefreshingProjects, setIsRefreshingProjects] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createExpanded, setCreateExpanded] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDomain, setNewProjectDomain] = useState('');
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);

  const locationLabel = useMemo(
    () => getResearchLocationLabel(locationCode),
    [locationCode]
  );
  const languageCode = useMemo(() => resolveLanguageCode(language), [language]);

  const loadProjects = useCallback(async () => {
    setIsRefreshingProjects(true);
    try {
      await refreshProjects();
    } finally {
      setIsRefreshingProjects(false);
    }
  }, [refreshProjects]);

  useEffect(() => {
    if (!open) return;
    setSelectedProjectId(activeProjectId ?? '');
    void loadProjects();
  }, [activeProjectId, loadProjects, open]);

  useEffect(() => {
    if (!open || selectedProjectId) return;
    setSelectedProjectId(activeProjectId ?? projects[0]?.id ?? '');
  }, [activeProjectId, open, projects, selectedProjectId]);

  useEffect(() => {
    if (!open) {
      setSelectedProjectId('');
      setTags([]);
      setTagInput('');
      setCreateExpanded(false);
      setNewProjectName('');
      setNewProjectDomain('');
    }
  }, [open]);

  const addTag = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setTags(current => (current.includes(trimmed) ? current : [...current, trimmed]));
    setTagInput('');
  }, []);

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(tagInput);
    } else if (event.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(current => current.slice(0, -1));
    }
  };

  const handleCreateProject = async () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) return;

    setIsSubmittingProject(true);
    try {
      const project = await createProject(trimmedName, newProjectDomain.trim() || undefined);
      await refreshProjects();
      setSelectedProjectId(project.id);
      setNewProjectName('');
      setNewProjectDomain('');
      setCreateExpanded(false);
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProjectId || selectedRows.length === 0) return;

    const payload: SaveKeywordInput[] = selectedRows.map(row => ({
      keyword: row.expression,
      location: locationLabel,
      locationCode,
      language,
      languageCode,
      searchVolume: row.searchVolume,
      cpc: row.cpc,
      intent: row.intention,
      kd: row.difficulty,
      rawLabsPayload: row.rawLabsPayload,
    }));

    setIsSaving(true);
    try {
      const result = await saveKeywords(selectedProjectId, payload, tags);
      if (result.error && result.created === 0) {
        throw new Error(result.error);
      }
      onSaved({
        created: result.created,
        skipped: result.skipped,
        harvested: result.harvested,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="space-y-3 border-b border-border px-6 py-5">
          <DialogTitle className="text-lg">Add to Tracker</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Save selected keywords to a project for ongoing rank tracking.
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2.5">
                <Hash className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                <p className="text-sm font-medium text-blue-900">
                  {selectedRows.length.toLocaleString()} keyword
                  {selectedRows.length === 1 ? '' : 's'} queued for insertion
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="tracker-project">Target Project</Label>
            {isLoadingProjectsContext || isRefreshingProjects ? (
              <div className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading projects…
              </div>
            ) : (
              <ProjectCombobox
                projects={projects}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                disabled={isSaving}
              />
            )}
          </div>

          <Collapsible open={createExpanded} onOpenChange={setCreateExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-2 px-0 text-blue-700 hover:bg-transparent hover:text-blue-800"
              >
                <FolderPlus className="h-4 w-4" aria-hidden />
                {createExpanded ? 'Hide new project form' : 'Create a new project'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3 rounded-lg border border-dashed border-border bg-muted/60 p-4">
              <div className="space-y-2">
                <Label htmlFor="new-project-name">Project Name</Label>
                <Input
                  id="new-project-name"
                  placeholder="e.g. Q3 Content Campaign"
                  value={newProjectName}
                  onChange={event => setNewProjectName(event.target.value)}
                  disabled={isSubmittingProject}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-project-domain">Target Domain</Label>
                <Input
                  id="new-project-domain"
                  placeholder="e.g. example.com"
                  value={newProjectDomain}
                  onChange={event => setNewProjectDomain(event.target.value)}
                  disabled={isSubmittingProject}
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={() => void handleCreateProject()}
                disabled={isSubmittingProject || !newProjectName.trim()}
              >
                {isSubmittingProject ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden />
                )}
                Create Project
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-2">
            <Label htmlFor="tracker-tags" className="inline-flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" aria-hidden />
              Tags
            </Label>
            <div className="rounded-lg border border-border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/20">
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.map(tag => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 pr-1 text-xs font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags(current => current.filter(item => item !== tag))}
                      className="rounded-sm p-0.5 hover:bg-gray-200"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </Badge>
                ))}
                <Input
                  id="tracker-tags"
                  value={tagInput}
                  onChange={event => setTagInput(event.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => addTag(tagInput)}
                  placeholder={tags.length ? 'Add another tag…' : 'e.g. Blog, BoFu — press Enter'}
                  className="h-8 min-w-[140px] flex-1 border-0 px-0 shadow-none focus-visible:ring-0"
                  disabled={isSaving}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tracking context: {locationLabel} · {language} ({languageCode})
            </p>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || !selectedProjectId || selectedRows.length === 0}
            className="min-w-[140px] gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" aria-hidden />
                Save Keywords
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
