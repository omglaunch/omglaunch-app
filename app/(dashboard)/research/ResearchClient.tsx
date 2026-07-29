'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from 'react';
import {
  fetchKeywordIdeas,
  fetchRecentResearchSearches,
  fetchRelatedKeywords,
  fetchRelatedQuestions,
  type RecentResearchSearch,
} from '@/app/actions/semantic-analysis';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebounce } from '@/hooks/useDebounce';
import { DEFAULT_SEMANTIC_LOCATION_CODE } from '@/lib/analysis-state';
import type { RelatedKeyword, RelatedKeywordIntention } from '@/lib/semantic-metrics';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowDownUp,
  ArrowRight,
  BarChart3,
  Check,
  ChevronsUpDown,
  ClipboardCopy,
  Download,
  Clock,
  Hash,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  getDataForSeoLabsLocationNotice,
  getResearchLocationLabel,
  RESEARCH_LOCATIONS,
} from './research-locations';
import SaveToTrackerModal from './SaveToTrackerModal';

type ResearchTab = 'keywords' | 'questions' | 'ideas';

type SortKey =
  | 'expression'
  | 'searchVolume'
  | 'cpc'
  | 'intention'
  | 'difficulty'
  | 'yoyChange';

type SortDirection = 'asc' | 'desc';

type TabFetchMeta = {
  cachedAt: string | null;
  fromCache: boolean;
};

type FetchOverrides = {
  keyword?: string;
  locationCode?: number;
  language?: string;
};

function formatRelativeCachedAt(isoDate: string): string {
  return formatDistanceToNow(new Date(isoDate), { addSuffix: true });
}

function resetSearchResults(setters: {
  setWordFilter: (value: string) => void;
  setMaxKd: (value: string) => void;
  setMinVolume: (value: string) => void;
  setLoadedTabs: (value: Set<ResearchTab>) => void;
  setKeywordsData: (value: RelatedKeyword[] | null) => void;
  setQuestionsData: (value: RelatedKeyword[] | null) => void;
  setIdeasData: (value: RelatedKeyword[] | null) => void;
  setKeywordsMeta: (value: TabFetchMeta | null) => void;
  setQuestionsMeta: (value: TabFetchMeta | null) => void;
  setIdeasMeta: (value: TabFetchMeta | null) => void;
}) {
  setters.setWordFilter('');
  setters.setMaxKd('');
  setters.setMinVolume('');
  setters.setLoadedTabs(new Set());
  setters.setKeywordsData(null);
  setters.setQuestionsData(null);
  setters.setIdeasData(null);
  setters.setKeywordsMeta(null);
  setters.setQuestionsMeta(null);
  setters.setIdeasMeta(null);
}

function RecentSearchesDropdown({
  open,
  items,
  isLoading,
  onSelect,
}: {
  open: boolean;
  items: RecentResearchSearch[];
  isLoading: boolean;
  onSelect: (item: RecentResearchSearch) => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      <div className="border-b border-border px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Searches</p>
      </div>

      {isLoading ? (
        <div className="space-y-2 px-3 py-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">No recent searches yet.</p>
      ) : (
        <ul className="max-h-72 overflow-y-auto py-1">
          {items.map(item => (
            <li key={`${item.keyword}-${item.locationCode}-${item.language}`}>
              <button
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => onSelect(item)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.keyword}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {item.locationLabel}
                    </span>
                    <span>{item.language}</span>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden />
                  {formatRelativeCachedAt(item.cachedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const RESEARCH_LANGUAGE_OPTIONS = [
  'English',
  'Malay',
  'Chinese',
  'Indonesian',
  'Thai',
  'Vietnamese',
] as const;

const PAGE_SIZE = 50;

const TABLE_WRAPPER =
  'competitor-audit-table w-full max-w-full overflow-x-auto overscroll-x-contain block whitespace-nowrap pb-4 rounded-lg border border-border bg-card shadow-sm';
const SCROLL_TABLE = 'competitor-scroll-table w-max min-w-full border-collapse text-sm';

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'for',
  'to',
  'in',
  'on',
  'of',
  'with',
  'is',
  'are',
  'at',
  'by',
  'from',
]);

const TAB_LABELS: Record<ResearchTab, string> = {
  keywords: 'related-keywords',
  questions: 'related-questions',
  ideas: 'keyword-ideas',
};

function TableScrollHint() {
  return (
    <div className="mb-2 flex w-full justify-end pr-1 md:hidden">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        Swipe to compare
        <ArrowRight size={14} aria-hidden />
      </span>
    </div>
  );
}

function formatVolume(value: number): string {
  return value.toLocaleString();
}

function formatCpc(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '$0.00';
  return `$${value.toFixed(2)}`;
}

function formatIntent(intent: RelatedKeywordIntention | null): string {
  if (!intent) return 'Unspecified';
  return intent.charAt(0).toUpperCase() + intent.slice(1);
}

function intentBadgeClass(intent: RelatedKeywordIntention | null): string {
  switch (intent) {
    case 'informational':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50';
    case 'commercial':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/50';
    case 'transactional':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50';
    case 'navigational':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function kdBadgeClass(value: number | null): string {
  if (value === null) return 'bg-muted text-muted-foreground border-border';
  if (value < 30) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50';
  if (value <= 70) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50';
  return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50';
}

function formatFreshness(meta: TabFetchMeta | null, isLoading: boolean): string {
  if (isLoading) return 'Fetching…';
  if (!meta) return '';
  if (!meta.fromCache) return 'Live';
  if (!meta.cachedAt) return 'Cached';

  const ageMs = Date.now() - new Date(meta.cachedAt).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  if (ageDays <= 0) return 'Last updated: today';
  if (ageDays === 1) return 'Last updated: 1 day ago';
  return `Last updated: ${ageDays} days ago`;
}

function extractTopWords(rows: RelatedKeyword[], seedKeyword: string, limit = 5): string[] {
  const seedTokens = new Set(
    seedKeyword
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
  );
  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const word of row.expression.toLowerCase().split(/\s+/)) {
      const cleaned = word.replace(/[^a-z0-9-]/g, '');
      if (!cleaned || cleaned.length < 3 || STOP_WORDS.has(cleaned) || seedTokens.has(cleaned)) {
        continue;
      }
      counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function computeIntentDistribution(rows: RelatedKeyword[]) {
  const withIntent = rows.filter(row => row.intention);
  const total = withIntent.length || 1;

  const informational = withIntent.filter(row => row.intention === 'informational').length;
  const commercialTransactional = withIntent.filter(
    row => row.intention === 'commercial' || row.intention === 'transactional'
  ).length;

  return {
    informationalPct: Math.round((informational / total) * 100),
    commercialTransactionalPct: Math.round((commercialTransactional / total) * 100),
  };
}

function SummaryMetricCard({
  label,
  value,
  icon: Icon,
  subtitle,
}: {
  label: string;
  value: string;
  icon: ElementType;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

function ZeroState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
        <Search className="h-7 w-7 text-emerald-400" aria-hidden />
      </div>
      <h2 className="mt-5 text-base font-semibold text-foreground">Discover search volumes & intent</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Enter a seed keyword to discover search volumes and intent across related keyword
        opportunities.
      </p>
    </div>
  );
}

function FilterEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 px-6 py-12 text-center">
      <Search className="mb-3 h-8 w-8 text-gray-300" aria-hidden />
      <p className="text-sm font-medium text-foreground">No keywords match your filters</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Try clearing the word filter or adjusting Max KD / Min Volume thresholds.
      </p>
    </div>
  );
}

function TrendSparkline({ points }: { points: RelatedKeyword['monthlySearches'] }) {
  if (!points.length) {
    return <div className="h-8 w-20 rounded bg-muted" aria-hidden />;
  }

  const sorted = [...points].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );
  const values = sorted.map(point => point.searchVolume);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const path = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const trendUp = values.length >= 2 && values[values.length - 1] >= values[0];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path
        d={path}
        fill="none"
        stroke={trendUp ? '#059669' : '#DC2626'}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function YoyBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <Badge variant="outline" className="border-border bg-muted text-[10px] text-muted-foreground">
        —
      </Badge>
    );
  }

  const positive = value >= 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] tabular-nums',
        positive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300'
      )}
    >
      {positive ? (
        <TrendingUp className="mr-0.5 h-3 w-3" aria-hidden />
      ) : (
        <TrendingDown className="mr-0.5 h-3 w-3" aria-hidden />
      )}
      {positive ? '+' : ''}
      {value}%
    </Badge>
  );
}

function SerpFeatureTags({ features }: { features: RelatedKeyword['serpFeatures'] }) {
  if (!features.localPack && !features.featuredSnippet) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {features.localPack ? (
        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-[10px] text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
          <MapPin className="mr-0.5 h-3 w-3" aria-hidden />
          Local
        </Badge>
      ) : null}
      {features.featuredSnippet ? (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Sparkles className="mr-0.5 h-3 w-3" aria-hidden />
          Snippet
        </Badge>
      ) : null}
    </div>
  );
}

function TableSkeleton() {
  const columns = ['w-4', 'w-40', 'w-28', 'w-16', 'w-14', 'w-20', 'w-24', 'w-12'];

  return (
    <div className={TABLE_WRAPPER}>
      <table className={SCROLL_TABLE}>
        <thead>
          <tr className="sticky top-0 z-20 border-b border-border bg-muted">
            {columns.map((width, index) => (
              <th key={index} className="px-4 py-3">
                <Skeleton className={cn('h-4 animate-pulse', width)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border">
              {columns.map((width, colIndex) => (
                <td key={colIndex} className="px-4 py-3">
                  <Skeleton className={cn('h-4 animate-pulse', width)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LocationCombobox({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (code: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="location"
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between font-normal"
        >
          <span className="truncate">{getResearchLocationLabel(value)}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search cities or countries…" />
          <CommandList>
            <CommandEmpty>No location found.</CommandEmpty>
            <CommandGroup heading="Countries">
              {RESEARCH_LOCATIONS.filter(location => location.region === 'Country').map(
                location => (
                  <CommandItem
                    key={location.code}
                    value={`${location.label} ${location.region}`}
                    onSelect={() => {
                      onChange(location.code);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === location.code ? 'opacity-100' : 'opacity-0'
                      )}
                      aria-hidden
                    />
                    {location.label}
                  </CommandItem>
                )
              )}
            </CommandGroup>
            <CommandGroup heading="Cities">
              {RESEARCH_LOCATIONS.filter(location => location.region === 'City').map(location => (
                <CommandItem
                  key={location.code}
                  value={`${location.label} ${location.region}`}
                  onSelect={() => {
                    onChange(location.code);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === location.code ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden
                  />
                  {location.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function ResearchClient() {
  const [seedKeyword, setSeedKeyword] = useState('');
  const [locationCode, setLocationCode] = useState<number>(DEFAULT_SEMANTIC_LOCATION_CODE);
  const [language, setLanguage] = useState<string>('English');
  const [activeTab, setActiveTab] = useState<ResearchTab>('keywords');

  const [keywordsData, setKeywordsData] = useState<RelatedKeyword[] | null>(null);
  const [questionsData, setQuestionsData] = useState<RelatedKeyword[] | null>(null);
  const [ideasData, setIdeasData] = useState<RelatedKeyword[] | null>(null);

  const [keywordsMeta, setKeywordsMeta] = useState<TabFetchMeta | null>(null);
  const [questionsMeta, setQuestionsMeta] = useState<TabFetchMeta | null>(null);
  const [ideasMeta, setIdeasMeta] = useState<TabFetchMeta | null>(null);

  const [loadedTabs, setLoadedTabs] = useState<Set<ResearchTab>>(new Set());
  const [loadingTab, setLoadingTab] = useState<ResearchTab | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wordFilter, setWordFilter] = useState('');
  const debouncedWordFilter = useDebounce(wordFilter, 300);
  const [maxKd, setMaxKd] = useState('');
  const [minVolume, setMinVolume] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('searchVolume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [trackerModalOpen, setTrackerModalOpen] = useState(false);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentResearchSearch[]>([]);
  const [isLoadingRecentSearches, setIsLoadingRecentSearches] = useState(false);

  const keywordFieldRef = useRef<HTMLDivElement>(null);
  const lastFetchParams = useRef<{ keyword: string; location: number; language: string } | null>(
    null
  );

  const activeData = useMemo(() => {
    switch (activeTab) {
      case 'questions':
        return questionsData;
      case 'ideas':
        return ideasData;
      default:
        return keywordsData;
    }
  }, [activeTab, ideasData, keywordsData, questionsData]);

  const activeMeta = useMemo(() => {
    switch (activeTab) {
      case 'questions':
        return questionsMeta;
      case 'ideas':
        return ideasMeta;
      default:
        return keywordsMeta;
    }
  }, [activeTab, ideasMeta, keywordsMeta, questionsMeta]);

  const locationNotice = useMemo(
    () => getDataForSeoLabsLocationNotice(locationCode),
    [locationCode]
  );

  const isLoading = loadingTab === activeTab;

  const fetchTabData = useCallback(
    async (tab: ResearchTab, forceRefresh: boolean, overrides?: FetchOverrides) => {
      const trimmed = (overrides?.keyword ?? seedKeyword).trim();
      const resolvedLocation = overrides?.locationCode ?? locationCode;
      const resolvedLanguage = overrides?.language ?? language;

      if (!trimmed) {
        setError('Enter a seed keyword to analyze.');
        return;
      }

      setError(null);
      setLoadingTab(tab);
      setHasSearched(true);
      setCurrentPage(1);
      lastFetchParams.current = {
        keyword: trimmed,
        location: resolvedLocation,
        language: resolvedLanguage,
      };

      const options = { language: resolvedLanguage, forceRefresh };

      try {
        if (tab === 'keywords') {
          const result = await fetchRelatedKeywords(trimmed, resolvedLocation, undefined, options);
          setKeywordsData(result.keywords);
          setKeywordsMeta({ cachedAt: result.cachedAt, fromCache: result.fromCache });
          if (result.error && result.keywords.length === 0) setError(result.error);
          else if (result.error) setError(result.error);
          setLoadedTabs(prev => new Set(prev).add('keywords'));
        } else if (tab === 'questions') {
          const result = await fetchRelatedQuestions(trimmed, resolvedLocation, options);
          setQuestionsData(result.questions);
          setQuestionsMeta({ cachedAt: result.cachedAt, fromCache: result.fromCache });
          if (result.error && result.questions.length === 0) setError(result.error);
          else if (result.error) setError(result.error);
          setLoadedTabs(prev => new Set(prev).add('questions'));
        } else {
          const result = await fetchKeywordIdeas(trimmed, resolvedLocation, options);
          setIdeasData(result.ideas);
          setIdeasMeta({ cachedAt: result.cachedAt, fromCache: result.fromCache });
          if (result.error && result.ideas.length === 0) setError(result.error);
          else if (result.error) setError(result.error);
          setLoadedTabs(prev => new Set(prev).add('ideas'));
        }
      } catch (fetchError) {
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : 'Failed to fetch keyword data. Please try again.';
        setError(message);
        if (tab === 'keywords') setKeywordsData([]);
        if (tab === 'questions') setQuestionsData([]);
        if (tab === 'ideas') setIdeasData([]);
      } finally {
        setLoadingTab(null);
      }
    },
    [language, locationCode, seedKeyword]
  );

  const loadRecentSearches = useCallback(async () => {
    setIsLoadingRecentSearches(true);
    try {
      const results = await fetchRecentResearchSearches();
      setRecentSearches(results);
    } finally {
      setIsLoadingRecentSearches(false);
    }
  }, []);

  const handleKeywordFocus = useCallback(() => {
    setShowRecentSearches(true);
    void loadRecentSearches();
  }, [loadRecentSearches]);

  const handleHistorySelect = useCallback(
    (item: RecentResearchSearch) => {
      setSeedKeyword(item.keyword);
      setLocationCode(item.locationCode);
      setLanguage(item.language);
      setShowRecentSearches(false);
      resetSearchResults({
        setWordFilter,
        setMaxKd,
        setMinVolume,
        setLoadedTabs,
        setKeywordsData,
        setQuestionsData,
        setIdeasData,
        setKeywordsMeta,
        setQuestionsMeta,
        setIdeasMeta,
      });
      void fetchTabData(activeTab, false, {
        keyword: item.keyword,
        locationCode: item.locationCode,
        language: item.language,
      });
    },
    [activeTab, fetchTabData]
  );

  useEffect(() => {
    if (!showRecentSearches) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        keywordFieldRef.current &&
        !keywordFieldRef.current.contains(event.target as Node)
      ) {
        setShowRecentSearches(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRecentSearches]);

  const handleAnalyze = useCallback(
    (forceRefresh = false) => {
      const trimmed = seedKeyword.trim();
      const paramsChanged =
        !lastFetchParams.current ||
        lastFetchParams.current.keyword !== trimmed ||
        lastFetchParams.current.location !== locationCode ||
        lastFetchParams.current.language !== language;

      if (paramsChanged) {
        resetSearchResults({
          setWordFilter,
          setMaxKd,
          setMinVolume,
          setLoadedTabs,
          setKeywordsData,
          setQuestionsData,
          setIdeasData,
          setKeywordsMeta,
          setQuestionsMeta,
          setIdeasMeta,
        });
      } else if (forceRefresh) {
        setLoadedTabs(prev => {
          const next = new Set(prev);
          next.delete(activeTab);
          return next;
        });
      }

      void fetchTabData(activeTab, forceRefresh);
    },
    [activeTab, fetchTabData, language, locationCode, seedKeyword]
  );

  useEffect(() => {
    if (!hasSearched || loadingTab) return;

    const params = lastFetchParams.current;
    const currentKeyword = seedKeyword.trim();
    const paramsMatch =
      params &&
      params.keyword === currentKeyword &&
      params.location === locationCode &&
      params.language === language;

    if (!paramsMatch) return;
    if (loadedTabs.has(activeTab)) return;

    void fetchTabData(activeTab, false);
  }, [
    activeTab,
    fetchTabData,
    hasSearched,
    language,
    loadedTabs,
    loadingTab,
    locationCode,
    seedKeyword,
  ]);

  const summary = useMemo(() => {
    const rows = activeData ?? [];
    const totalKeywords = rows.length;
    const totalVolume = rows.reduce((sum, row) => sum + row.searchVolume, 0);
    const difficultyRows = rows.filter(row => row.difficulty !== null);
    const avgDifficulty =
      difficultyRows.length > 0
        ? Math.round(
            difficultyRows.reduce((sum, row) => sum + (row.difficulty ?? 0), 0) /
              difficultyRows.length
          )
        : 0;
    const intentDistribution = computeIntentDistribution(rows);

    return { totalKeywords, totalVolume, avgDifficulty, intentDistribution };
  }, [activeData]);

  const quickFilterWords = useMemo(
    () => extractTopWords(activeData ?? [], seedKeyword),
    [activeData, seedKeyword]
  );

  const filteredRows = useMemo(() => {
    const rows = activeData ?? [];
    const query = debouncedWordFilter.trim().toLowerCase();
    const parsedMaxKd = maxKd.trim() === '' ? null : Number(maxKd);
    const parsedMinVolume = minVolume.trim() === '' ? null : Number(minVolume);

    let result = rows;

    if (query) {
      result = result.filter(row => row.expression.toLowerCase().includes(query));
    }

    if (parsedMaxKd !== null && Number.isFinite(parsedMaxKd)) {
      result = result.filter(row => row.difficulty === null || row.difficulty <= parsedMaxKd);
    }

    if (parsedMinVolume !== null && Number.isFinite(parsedMinVolume)) {
      result = result.filter(row => row.searchVolume >= parsedMinVolume);
    }

    return [...result].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'expression':
          comparison = a.expression.localeCompare(b.expression);
          break;
        case 'searchVolume':
          comparison = a.searchVolume - b.searchVolume;
          break;
        case 'cpc':
          comparison = (a.cpc ?? 0) - (b.cpc ?? 0);
          break;
        case 'intention':
          comparison = (a.intention ?? '').localeCompare(b.intention ?? '');
          break;
        case 'difficulty':
          comparison = (a.difficulty ?? -1) - (b.difficulty ?? -1);
          break;
        case 'yoyChange':
          comparison = (a.yoyChange ?? 0) - (b.yoyChange ?? 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [activeData, debouncedWordFilter, maxKd, minVolume, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const allVisibleSelected =
    paginatedRows.length > 0 && paginatedRows.every(row => selectedKeywords.has(row.expression));

  const selectedKeywordRows = useMemo(() => {
    const rows = activeData ?? [];
    return rows.filter(row => selectedKeywords.has(row.expression));
  }, [activeData, selectedKeywords]);

  const handleTrackerSaved = useCallback(
    ({
      created,
      skipped,
      harvested = 0,
    }: {
      created: number;
      skipped: number;
      harvested?: number;
    }) => {
      setSelectedKeywords(new Set());
      setTrackerModalOpen(false);

      if (created === 0 && skipped > 0) {
        toast.success('All selected keywords were already in this project.', {
          description: `${skipped} duplicate${skipped === 1 ? '' : 's'} filtered to save tracking costs.`,
        });
        return;
      }

      const harvestNote =
        harvested > 0
          ? ` ${harvested} baseline rank${harvested === 1 ? '' : 's'} harvested from Labs data ($0).`
          : '';

      const description =
        skipped > 0
          ? `${created} keyword${created === 1 ? '' : 's'} added. ${skipped} duplicate${skipped === 1 ? '' : 's'} filtered out.${harvestNote}`
          : `${created} keyword${created === 1 ? '' : 's'} added to your tracker project.${harvestNote}`;

      toast.success('Keywords saved to tracker', { description });
    },
    []
  );

  const toggleSort = (key: SortKey) => {
    setCurrentPage(1);
    if (sortKey === key) {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'expression' || key === 'intention' ? 'asc' : 'desc');
  };

  const toggleRowSelection = (expression: string) => {
    setSelectedKeywords(prev => {
      const next = new Set(prev);
      if (next.has(expression)) next.delete(expression);
      else next.add(expression);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedKeywords(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const row of paginatedRows) next.delete(row.expression);
      } else {
        for (const row of paginatedRows) next.add(row.expression);
      }
      return next;
    });
  };

  const handleCopySelected = async () => {
    const selected = Array.from(selectedKeywords).join('\n');
    if (!selected) return;
    await navigator.clipboard.writeText(selected);
  };

  function handleExportCsv() {
    const header = [
      'Keyword',
      'Search Volume',
      'CPC',
      'Intent',
      'Keyword Difficulty',
      'YoY Change',
      'Local Pack',
      'Featured Snippet',
    ];
    const lines = filteredRows.map(row => [
      row.expression,
      row.searchVolume,
      row.cpc !== null ? row.cpc.toFixed(2) : '0.00',
      formatIntent(row.intention),
      row.difficulty ?? '',
      row.yoyChange ?? '',
      row.serpFeatures.localPack ? 'Yes' : 'No',
      row.serpFeatures.featuredSnippet ? 'Yes' : 'No',
    ]);
    const csv = [header, ...lines]
      .map(cols => cols.map(col => `"${String(col).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const slug = seedKeyword.trim().replace(/\s+/g, '-').toLowerCase() || 'export';
    anchor.download = `${slug}_${TAB_LABELS[activeTab]}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const SortableHeader = ({
    label,
    columnKey,
    className,
  }: {
    label: string;
    columnKey: SortKey;
    className?: string;
  }) => (
    <th
      scope="col"
      className={cn(
        'sticky top-0 z-20 bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        className
      )}
    >
      <button
        type="button"
        onClick={() => toggleSort(columnKey)}
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        {label}
        <ArrowDownUp
          className={cn(
            'h-3 w-3',
            sortKey === columnKey ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
          )}
          aria-hidden
        />
      </button>
    </th>
  );

  const showResults = hasSearched && (activeData !== null || isLoading);
  const hasActiveData = (activeData?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
          <BarChart3 className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Research Volumes
          </div>
          <h1 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">Enterprise SEO Research Hub</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Discover related keywords, questions, and ideas with monthly search volumes, CPC, intent
            signals, SERP features, and keyword difficulty for any seed term.
          </p>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Search Configuration</CardTitle>
          <CardDescription>
            Enter a seed keyword and target market to pull keyword intelligence from DataForSEO.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-4 lg:grid-cols-12 lg:items-end"
            onSubmit={event => {
              event.preventDefault();
              handleAnalyze(false);
            }}
          >
            <div className="relative space-y-2 lg:col-span-4" ref={keywordFieldRef}>
              <Label htmlFor="seed-keyword">Primary Keyword</Label>
              <Input
                id="seed-keyword"
                placeholder="e.g. digital marketing agency"
                value={seedKeyword}
                onChange={event => setSeedKeyword(event.target.value)}
                onFocus={handleKeywordFocus}
                disabled={loadingTab !== null}
                autoComplete="off"
              />
              <RecentSearchesDropdown
                open={showRecentSearches}
                items={recentSearches}
                isLoading={isLoadingRecentSearches}
                onSelect={handleHistorySelect}
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="location">Location</Label>
              <LocationCombobox
                value={locationCode}
                onChange={setLocationCode}
                disabled={loadingTab !== null}
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={setLanguage} disabled={loadingTab !== null}>
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {RESEARCH_LANGUAGE_OPTIONS.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:col-span-4 lg:justify-end">
              <Button type="submit" disabled={loadingTab !== null} className="min-w-[120px] bg-emerald-600 hover:bg-emerald-500">
                Analyze
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={loadingTab !== null || !seedKeyword.trim()}
                onClick={() => handleAnalyze(true)}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Force Refresh
              </Button>
              {hasSearched ? (
                <span className="text-xs text-muted-foreground">{formatFreshness(activeMeta, isLoading)}</span>
              ) : null}
            </div>
          </form>

          <Tabs
            value={activeTab}
            onValueChange={value => setActiveTab(value as ResearchTab)}
          >
            <TabsList className="grid w-full max-w-lg grid-cols-3 bg-muted">
              <TabsTrigger value="keywords">Related Keywords</TabsTrigger>
              <TabsTrigger value="questions">Related Questions</TabsTrigger>
              <TabsTrigger value="ideas">Keyword Ideas</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {locationNotice ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          {locationNotice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {!hasSearched && !loadingTab ? <ZeroState /> : null}

      {showResults ? (
        <div className="space-y-6">
          {isLoading ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 animate-pulse rounded-xl" />
                ))}
              </div>
              <TableSkeleton />
            </>
          ) : activeData !== null ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryMetricCard
                  label="Total Keywords"
                  value={summary.totalKeywords.toLocaleString()}
                  icon={Hash}
                />
                <SummaryMetricCard
                  label="Total Volume"
                  value={formatVolume(summary.totalVolume)}
                  icon={TrendingUp}
                />
                <SummaryMetricCard
                  label="Average KD"
                  value={String(summary.avgDifficulty)}
                  icon={BarChart3}
                />
                <SummaryMetricCard
                  label="Intent Distribution"
                  value={`${summary.intentDistribution.informationalPct}% / ${summary.intentDistribution.commercialTransactionalPct}%`}
                  icon={Sparkles}
                  subtitle="Informational vs Commercial/Transactional"
                />
              </div>

              {hasActiveData ? (
                <>
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 self-start"
                      onClick={handleExportCsv}
                      disabled={filteredRows.length === 0}
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      Export to CSV
                    </Button>

                    <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:min-w-[480px]">
                      <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                        <Label htmlFor="word-filter" className="text-xs text-muted-foreground">
                          Filter by Word
                        </Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            id="word-filter"
                            placeholder="Contains…"
                            value={wordFilter}
                            onChange={event => {
                              setWordFilter(event.target.value);
                              setCurrentPage(1);
                            }}
                            className="h-9 max-w-xs"
                          />
                          {quickFilterWords.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Quick:
                              </span>
                              {quickFilterWords.map(word => (
                                <button
                                  key={word}
                                  type="button"
                                  onClick={() => {
                                    setWordFilter(word);
                                    setCurrentPage(1);
                                  }}
                                  className={cn(
                                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                                    debouncedWordFilter === word
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      : 'border-border bg-muted text-muted-foreground hover:border-border'
                                  )}
                                >
                                  {word}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="max-kd" className="text-xs text-muted-foreground">
                          Max KD
                        </Label>
                        <Input
                          id="max-kd"
                          type="number"
                          min={0}
                          max={100}
                          placeholder="100"
                          value={maxKd}
                          onChange={event => {
                            setMaxKd(event.target.value);
                            setCurrentPage(1);
                          }}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="min-volume" className="text-xs text-muted-foreground">
                          Min Volume
                        </Label>
                        <Input
                          id="min-volume"
                          type="number"
                          min={0}
                          placeholder="0"
                          value={minVolume}
                          onChange={event => {
                            setMinVolume(event.target.value);
                            setCurrentPage(1);
                          }}
                          className="h-9"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground lg:ml-auto lg:self-center">
                      Showing {filteredRows.length.toLocaleString()} of{' '}
                      {activeData.length.toLocaleString()} keywords
                    </p>
                  </div>

                  {selectedKeywords.size > 0 ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
                      <span className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                        {selectedKeywords.size} selected
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-card"
                        onClick={() => void handleCopySelected()}
                      >
                        <ClipboardCopy className="h-4 w-4" aria-hidden />
                        Copy to Clipboard
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-2 bg-emerald-600 hover:bg-emerald-500"
                        onClick={() => setTrackerModalOpen(true)}
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                        Add to Tracker
                      </Button>
                    </div>
                  ) : null}

                  {filteredRows.length === 0 ? (
                    <FilterEmptyState />
                  ) : (
                    <>
                      <TableScrollHint />

                      <div className={TABLE_WRAPPER}>
                        <table className={SCROLL_TABLE}>
                          <thead>
                            <tr className="border-b border-border bg-muted">
                              <th className="sticky top-0 z-20 bg-muted px-4 py-3">
                                <Checkbox
                                  checked={allVisibleSelected}
                                  onCheckedChange={toggleSelectAllVisible}
                                  aria-label="Select all visible rows"
                                />
                              </th>
                              <SortableHeader label="Keyword" columnKey="expression" />
                              <th className="sticky top-0 z-20 bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Trend
                              </th>
                              <SortableHeader label="Volume" columnKey="searchVolume" />
                              <SortableHeader label="CPC" columnKey="cpc" />
                              <SortableHeader label="Intent" columnKey="intention" />
                              <th className="sticky top-0 z-20 bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                SERP Features
                              </th>
                              <SortableHeader label="KD" columnKey="difficulty" />
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedRows.map((row, index) => (
                              <tr
                                key={`${row.expression}-${index}`}
                                className={cn(
                                  'border-b border-border last:border-b-0',
                                  index % 2 === 1 && 'bg-muted'
                                )}
                              >
                                <td className="px-4 py-3">
                                  <Checkbox
                                    checked={selectedKeywords.has(row.expression)}
                                    onCheckedChange={() => toggleRowSelection(row.expression)}
                                    aria-label={`Select ${row.expression}`}
                                  />
                                </td>
                                <td className="px-4 py-3 font-medium text-foreground">
                                  {row.expression}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <TrendSparkline points={row.monthlySearches} />
                                    <YoyBadge value={row.yoyChange} />
                                  </div>
                                </td>
                                <td className="px-4 py-3 tabular-nums text-foreground">
                                  {formatVolume(row.searchVolume)}
                                </td>
                                <td className="px-4 py-3 tabular-nums text-foreground">
                                  {formatCpc(row.cpc)}
                                </td>
                                <td className="px-4 py-3">
                                  {row.intention ? (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-xs font-medium',
                                        intentBadgeClass(row.intention)
                                      )}
                                    >
                                      {formatIntent(row.intention)}
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="border-border bg-muted text-xs text-muted-foreground"
                                    >
                                      Unspecified
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <SerpFeatureTags features={row.serpFeatures} />
                                </td>
                                <td className="px-4 py-3">
                                  {row.difficulty !== null ? (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-xs font-semibold tabular-nums',
                                        kdBadgeClass(row.difficulty)
                                      )}
                                    >
                                      {row.difficulty}
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="border-border bg-muted text-xs text-muted-foreground"
                                    >
                                      Unspecified
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                        <span className="tabular-nums">
                          Page {safePage} of {totalPages}
                          <span className="hidden sm:inline">
                            {' '}
                            · {paginatedRows.length} rows on this page
                          </span>
                        </span>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                            disabled={safePage <= 1}
                          >
                            Previous
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                            disabled={safePage >= totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-border bg-card px-6 py-12 text-center shadow-sm">
                  <p className="text-sm text-muted-foreground">
                    No results were returned for this tab. Try a broader term or different location.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      ) : null}

      <SaveToTrackerModal
        open={trackerModalOpen}
        onOpenChange={setTrackerModalOpen}
        selectedRows={selectedKeywordRows}
        locationCode={locationCode}
        language={language}
        onSaved={handleTrackerSaved}
      />
    </div>
  );
}
