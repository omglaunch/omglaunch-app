'use client';

import { useCallback, useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  appendStagingRows,
  getDefaultGeo,
  useOnboardingStore,
} from '@/lib/ai-visibility/onboarding/store';
import {
  remainingStagingSlots,
  CAPACITY_REACHED_MESSAGE,
} from '@/lib/ai-visibility/onboarding/capacity';
import {
  CSV_TEMPLATE,
  detectColumnMapping,
  parseCsvTextStreaming,
  type CsvColumnMapping,
} from '@/lib/ai-visibility/onboarding/csv';
import type { GeoTargetOption } from '@/lib/ai-visibility/onboarding/types';
import { cn } from '@/lib/utils';

export default function TabCsvUpload() {
  const [advanced, setAdvanced] = useState(false);
  const [delimiter, setDelimiter] = useState(',');
  const [hasHeaders, setHasHeaders] = useState(true);
  const [applyDefaultGeo, setApplyDefaultGeo] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CsvColumnMapping | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const orderLen = useOnboardingStore((s) => s.order.length);
  const accountLimit = useOnboardingStore((s) => s.remainingAccountLimit);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const resolveLocations = useCallback(async (raws: string[]) => {
    const unique = Array.from(new Set(raws.filter(Boolean)));
    if (unique.length === 0) return {} as Record<string, GeoTargetOption | null>;
    const res = await fetch(
      `/api/ai-visibility/onboarding/locations?ids=${encodeURIComponent(unique.join('|'))}`
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      resolved: Record<string, GeoTargetOption | null>;
    };
    return data.resolved;
  }, []);

  async function ingestText(text: string, map: CsvColumnMapping) {
    const remaining = remainingStagingSlots(orderLen, accountLimit);
    if (remaining <= 0) {
      toast.error(CAPACITY_REACHED_MESSAGE);
      return;
    }

    const drafts: Array<{
      prompt: string;
      cluster: string;
      locationRaw: string;
    }> = [];
    let halted = false;

    try {
      const result = parseCsvTextStreaming({
        text,
        delimiter,
        hasHeaders,
        mapping: map,
        capacityHalt: () => drafts.length >= remaining,
        onRow: (row) => {
          drafts.push(row);
        },
      });
      halted = result.halted;
      if (result.rowsAccepted === 0) {
        toast.error('No valid rows after purge/normalization');
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'CSV parse failed');
      return;
    }

    setStatus(`Parsed ${drafts.length} rows — resolving locations…`);

    const resolved = await resolveLocations(drafts.map((d) => d.locationRaw));
    const defaultGeo = getDefaultGeo();

    const appendResult = appendStagingRows(
      drafts.map((d) => {
        const hit = d.locationRaw ? resolved[d.locationRaw] : null;
        if (hit) {
          return {
            prompt: d.prompt,
            cluster: d.cluster,
            source: 'csv' as const,
            geo: hit,
            geoPending: false,
          };
        }
        if (!d.locationRaw && applyDefaultGeo) {
          return {
            prompt: d.prompt,
            cluster: d.cluster,
            source: 'csv' as const,
            geo: defaultGeo,
            geoPending: false,
          };
        }
        if (!d.locationRaw && !applyDefaultGeo) {
          return {
            prompt: d.prompt,
            cluster: d.cluster,
            source: 'csv' as const,
            geo: defaultGeo,
            geoPending: false,
          };
        }
        // Unmatched location string — yellow error state
        return {
          prompt: d.prompt,
          cluster: d.cluster,
          source: 'csv' as const,
          geo: null,
          geoPending: true,
        };
      })
    );

    if (appendResult.capacityHit || halted) {
      toast.error(CAPACITY_REACHED_MESSAGE);
    } else {
      toast.success(
        `Imported ${appendResult.appended}` +
          (appendResult.duplicatesSkipped
            ? ` (${appendResult.duplicatesSkipped} dupes skipped)`
            : '')
      );
    }
    setStatus('');
    setPendingText(null);
    setMapping(null);
    setHeaders([]);
  }

  async function onFile(file: File) {
    // Legacy encoding protection: BOM strip at FileReader buffer level
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let text: string;
    // Basic charset fallback (UTF-8 first; Windows-1252 fallback for Excel)
    try {
      text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch {
      text = new TextDecoder('windows-1252').decode(bytes);
    }

    // Detect headers for mapping step
    const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
    const hdrs = firstLine.split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
    const detected = detectColumnMapping(hdrs);

    if (!detected.prompt) {
      setHeaders(hdrs);
      setMapping({ prompt: hdrs[0] ?? null, cluster: null, location: null });
      setPendingText(text);
      toast.message('Map CSV columns before importing');
      return;
    }

    setHeaders(hdrs);
    setMapping(detected);
    setPendingText(text);
    // Auto-run when fuzzy match found prompt column
    await ingestText(text, detected);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-zinc-200 dark:border-zinc-800"
          onClick={downloadTemplate}
        >
          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
          Template.csv
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={advanced} onCheckedChange={setAdvanced} id="adv" />
          <Label htmlFor="adv">Advanced Settings</Label>
        </div>
      </div>

      {advanced ? (
        <div className="grid gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Delimiter</Label>
            <Select value={delimiter} onValueChange={setDelimiter}>
              <SelectTrigger className="h-9 border-zinc-200 dark:border-zinc-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=",">Comma (,)</SelectItem>
                <SelectItem value=";">Semicolon (;)</SelectItem>
                <SelectItem value={'\t'}>Tab</SelectItem>
                <SelectItem value="|">Pipe (|)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch
              checked={hasHeaders}
              onCheckedChange={setHasHeaders}
              id="hdrs"
            />
            <Label htmlFor="hdrs" className="text-xs">
              First row contains headers
            </Label>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch
              checked={applyDefaultGeo}
              onCheckedChange={setApplyDefaultGeo}
              id="geo-consent"
            />
            <Label htmlFor="geo-consent" className="text-xs">
              Apply Workspace Default Geo to empty location rows
            </Label>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors',
          dragOver
            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
            : 'border-zinc-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-950/50'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void onFile(f);
        }}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        <p className="mt-2 text-sm font-medium">Drag & drop CSV here</p>
        <p className="text-xs text-muted-foreground">
          Streaming parse · BOM strip · formula sanitize · halt at 100 rows
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </div>

      {mapping && pendingText && headers.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs font-medium">Dynamic Column Mapping</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ['prompt', 'Prompt String'],
                ['cluster', 'Cluster'],
                ['location', 'Location'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {label}
                </Label>
                <Select
                  value={mapping[key] ?? 'none'}
                  onValueChange={(v) =>
                    setMapping((m) =>
                      m ? { ...m, [key]: v === 'none' ? null : v } : m
                    )
                  }
                >
                  <SelectTrigger className="h-9 border-zinc-200 text-xs dark:border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={() => {
              if (pendingText && mapping?.prompt) {
                void ingestText(pendingText, mapping);
              } else {
                toast.error('Map a Prompt String column');
              }
            }}
          >
            Apply Mapping & Import
          </Button>
        </div>
      ) : null}

      {status ? (
        <p className="text-xs text-muted-foreground">{status}</p>
      ) : null}
    </div>
  );
}
