'use client';

import { useEffect, useState } from 'react';
import {
  Download,
  Link2,
  Loader2,
  MapPin,
  Printer,
  Radar,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from '@/components/ui/sonner';
import GeogridHeatMap, { GeogridRankLegend } from '@/components/local-dominance/GeogridHeatMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { GeogridRunResult, GridSize } from '@/lib/local-dominance/types';
import type { SavedGeogridAudit } from '@/lib/local-dominance/map-audit-result';
import { GRID_SIZE_OPTIONS, GEOGRID_CREDIT_COSTS } from '@/lib/local-dominance/constants';
import { computeCorporateRollup } from '@/lib/local-dominance/grid-utils';

type GeogridIntelTabProps = {
  projectId: string;
  canWrite?: boolean;
  defaultBusinessName?: string;
  onAuditComplete: () => void;
  locationScores?: number[];
  selectedAuditId?: string;
  loadedAudit?: SavedGeogridAudit | null;
  isLoadingAudit?: boolean;
  onAuditRunComplete?: (auditId: string) => void;
};

const cardSurface =
  'border-zinc-200 bg-white dark:border-slate-800 dark:bg-slate-900/50';
const inputSurface =
  'border-zinc-300 bg-white text-zinc-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const labelMuted = 'text-zinc-600 dark:text-slate-300';
const titleText = 'text-zinc-900 dark:text-slate-100';
const mutedText = 'text-zinc-500 dark:text-slate-400';
const primaryCta =
  'bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-blue-600 dark:hover:bg-blue-500';
const outlineBtn =
  'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800';

export default function GeogridIntelTab({
  projectId,
  canWrite = true,
  defaultBusinessName = '',
  onAuditComplete,
  locationScores = [],
  selectedAuditId,
  loadedAudit = null,
  isLoadingAudit = false,
  onAuditRunComplete,
}: GeogridIntelTabProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [keyword, setKeyword] = useState('');
  const [centralGps, setCentralGps] = useState('');
  const [radiusKm, setRadiusKm] = useState('5');
  const [gridSize, setGridSize] = useState<GridSize>(5);
  const [platform, setPlatform] = useState<'google' | 'bing'>('google');
  const [businessName, setBusinessName] = useState('');
  const [businessCid, setBusinessCid] = useState('');
  const [scheduleRun, setScheduleRun] = useState(false);
  const [corporateView, setCorporateView] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<GeogridRunResult | null>(null);

  useEffect(() => {
    if (defaultBusinessName && !businessName) {
      setBusinessName(defaultBusinessName);
    }
  }, [defaultBusinessName, businessName]);

  useEffect(() => {
    if (isLoadingAudit) {
      return;
    }

    if (!loadedAudit) {
      if (!selectedAuditId) {
        setResult(null);
      }
      return;
    }

    setKeyword(loadedAudit.keyword);
    setCentralGps(`${loadedAudit.centralLat}, ${loadedAudit.centralLng}`);
    setRadiusKm(String(loadedAudit.radiusKm));
    setGridSize(loadedAudit.gridSize);
    setPlatform(loadedAudit.platform);
    setBusinessName(loadedAudit.businessName ?? '');
    setBusinessCid(loadedAudit.businessCid ?? '');
    setResult(loadedAudit);
  }, [loadedAudit, isLoadingAudit, selectedAuditId]);

  function parseGps(value: string): { lat: number; lng: number } | null {
    const parts = value.split(',').map(p => p.trim());
    if (parts.length !== 2) return null;
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  async function runGeogrid() {
    const gps = parseGps(centralGps);
    if (!keyword.trim()) {
      toast.error('Enter a target keyword');
      return;
    }

    setIsRunning(true);
    try {
      const response = await fetch('/api/local-dominance/geogrid/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          keyword: keyword.trim(),
          centralLat: gps?.lat,
          centralLng: gps?.lng,
          radiusKm: Number(radiusKm) || 5,
          gridSize,
          platform,
          businessName: businessName.trim() || undefined,
          businessCid: businessCid.trim() || undefined,
          scheduleRun,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? 'Geogrid run failed');
        return;
      }

      const runResult = data as GeogridRunResult;
      setResult(runResult);
      onAuditRunComplete?.(runResult.auditId);

      if (runResult.resolvedCenter && !gps) {
        setCentralGps(`${runResult.resolvedCenter.lat}, ${runResult.resolvedCenter.lng}`);
      }

      const cellsWithMapPack = runResult.gridResults.filter(
        cell => cell.mapPack.length > 0
      ).length;
      if (cellsWithMapPack === 0) {
        toast.warning(
          'Audit completed but no map results were returned. Check keyword, GPS coordinates, and business name.'
        );
      } else if (runResult.resolvedCenter && runResult.resolvedCenter.source !== 'manual') {
        const center = runResult.resolvedCenter;
        const sourceLabel =
          center.source === 'business_name'
            ? `business "${businessName.trim()}"`
            : center.source === 'keyword'
              ? `keyword "${keyword.trim()}"`
              : center.locationLabel;
        toast.success(
          `Geogrid audit complete — GPS auto-detected from ${sourceLabel}`
        );
      } else {
        toast.success('Geogrid audit complete');
      }

      onAuditComplete();
    } catch {
      toast.error('Geogrid run failed');
    } finally {
      setIsRunning(false);
    }
  }

  async function exportCsv() {
    if (!result) return;
    const rows = [
      ['Row', 'Col', 'Lat', 'Lng', 'Rank', 'Business', 'AI Visible'],
      ...result.gridResults.map(c => [
        c.row,
        c.col,
        c.lat,
        c.lng,
        c.rank ?? '',
        c.businessName ?? '',
        c.aiVisible ?? '',
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geogrid-${keyword}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generateShareLink() {
    if (!result?.auditId) return;
    const response = await fetch('/api/local-dominance/geogrid/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditId: result.auditId }),
    });
    const data = await response.json();
    if (data.shareUrl) {
      await navigator.clipboard.writeText(data.shareUrl);
      toast.success('Public share link copied to clipboard');
    }
  }

  function printReport() {
    window.print();
  }

  const displaySolv = corporateView
    ? computeCorporateRollup([result?.solvScore ?? 0, ...locationScores])
    : result?.solvScore ?? 0;

  const chartGrid = isDark ? '#334155' : '#e4e4e7';
  const chartAxis = isDark ? '#94a3b8' : '#71717a';
  const chartTooltip = isDark
    ? { background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }
    : { background: '#ffffff', border: '1px solid #e4e4e7', color: '#18181b' };

  return (
    <div className="space-y-6">
      {canWrite ? (
      <Card className={cardSurface}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${titleText}`}>
            <MapPin className="h-5 w-5 text-emerald-600 dark:text-blue-400" />
            Geogrid Diagnostic Engine
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label className={labelMuted}>Keyword</Label>
            <Input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="plumber near me"
              className={inputSurface}
            />
          </div>
          <div className="space-y-2">
            <Label className={labelMuted}>
              Central GPS (lat,lng){' '}
              <span className="font-normal text-zinc-400 dark:text-slate-500">optional</span>
            </Label>
            <Input
              value={centralGps}
              onChange={e => setCentralGps(e.target.value)}
              placeholder="Auto-detected from business name or keyword"
              className={inputSurface}
            />
            <p className="text-xs text-zinc-500 dark:text-slate-500">
              Leave blank to auto-detect. Business name gives the best result; otherwise we infer
              area from your keyword (defaults to Malaysia).
            </p>
          </div>
          <div className="space-y-2">
            <Label className={labelMuted}>Radius (km)</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={radiusKm}
              onChange={e => setRadiusKm(e.target.value)}
              className={inputSurface}
            />
          </div>
          <div className="space-y-2">
            <Label className={labelMuted}>Grid Size</Label>
            <Select value={String(gridSize)} onValueChange={v => setGridSize(Number(v) as GridSize)}>
              <SelectTrigger className={inputSurface}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRID_SIZE_OPTIONS.map(size => (
                  <SelectItem key={size} value={String(size)}>
                    {size}×{size} ({GEOGRID_CREDIT_COSTS[size]} credits)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className={labelMuted}>Platform</Label>
            <ToggleGroup
              type="single"
              value={platform}
              onValueChange={v => v && setPlatform(v as 'google' | 'bing')}
              className="justify-start"
            >
              <ToggleGroupItem
                value="google"
                className="border-zinc-300 data-[state=on]:bg-emerald-600 data-[state=on]:text-white dark:border-slate-700 dark:data-[state=on]:bg-blue-600"
              >
                Google Maps
              </ToggleGroupItem>
              <ToggleGroupItem
                value="bing"
                className="border-zinc-300 data-[state=on]:bg-emerald-600 data-[state=on]:text-white dark:border-slate-700 dark:data-[state=on]:bg-blue-600"
              >
                Bing Local
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label className={labelMuted}>Business Name / CID</Label>
            <Input
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="Business name"
              className={`mb-2 ${inputSurface}`}
            />
            <Input
              value={businessCid}
              onChange={e => setBusinessCid(e.target.value)}
              placeholder="Google CID (optional)"
              className={inputSurface}
            />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Switch checked={scheduleRun} onCheckedChange={setScheduleRun} id="schedule" />
            <Label htmlFor="schedule" className={labelMuted}>
              Schedule recurring run (weekly cron)
            </Label>
          </div>
          <div className="flex items-end">
            <Button onClick={runGeogrid} disabled={isRunning} className={`w-full ${primaryCta}`}>
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Diagnostic…
                </>
              ) : (
                'Run Geogrid Audit'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      ) : (
        <Card className={cardSurface}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${titleText}`}>
              <MapPin className="h-5 w-5 text-emerald-600 dark:text-blue-400" />
              Geogrid Reports
            </CardTitle>
            <CardDescription className={mutedText}>
              Read-only access — select a saved audit from history to view results and share links.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {isLoadingAudit && (
        <Card className={cardSurface}>
          <CardContent className={`flex items-center justify-center gap-2 py-12 ${mutedText}`}>
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600 dark:text-blue-400" />
            Loading saved audit results…
          </CardContent>
        </Card>
      )}

      {result && !isLoadingAudit && (
        <div className="space-y-6 print:space-y-4">
          {result.resolvedCenter && (
            <p className="text-xs text-zinc-500 dark:text-slate-500">
              Grid center: {result.resolvedCenter.lat}, {result.resolvedCenter.lng}
              {result.resolvedCenter.source !== 'manual'
                ? ` · auto-detected from ${result.resolvedCenter.source.replace('_', ' ')} (${result.resolvedCenter.locationLabel})`
                : ''}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-800 dark:bg-emerald-950/50">
              <span className="text-xs text-emerald-700 dark:text-emerald-400">Share of Local Voice</span>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{displaySolv}%</p>
            </div>
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2 dark:border-cyan-800 dark:bg-cyan-950/50">
              <span className="text-xs text-cyan-700 dark:text-cyan-400">Share of AI Voice</span>
              <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{result.saivScore}%</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              <Switch checked={corporateView} onCheckedChange={setCorporateView} id="corporate" />
              <Label htmlFor="corporate" className={`text-sm ${mutedText}`}>
                Corporate Roll-Up
              </Label>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <Button variant="outline" size="sm" onClick={printReport} className={outlineBtn}>
                <Printer className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Print </span>Report
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} className={outlineBtn}>
                <Download className="mr-1 h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={generateShareLink} className={outlineBtn}>
                <Link2 className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Share </span>Link
              </Button>
            </div>
          </div>

          <Card className={cardSurface}>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className={titleText}>Interactive Heat Map</CardTitle>
                <CardDescription className={mutedText}>
                  {gridSize}×{gridSize} grid · {gridSize * gridSize} points · click a cell for map pack
                </CardDescription>
              </div>
              <GeogridRankLegend className="sm:max-w-[280px] sm:justify-end" />
            </CardHeader>
            <CardContent className="flex justify-center py-4">
              <GeogridHeatMap cells={result.gridResults} gridSize={gridSize} />
            </CardContent>
          </Card>

          {result.trendData.length > 0 && (
            <Card className={cardSurface}>
              <CardHeader>
                <CardTitle className={titleText}>SoLV vs GBP Performance</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="date" stroke={chartAxis} fontSize={12} />
                    <YAxis yAxisId="left" stroke="#34d399" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" stroke="#60a5fa" fontSize={12} />
                    <Tooltip contentStyle={chartTooltip} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="solv" stroke="#34d399" name="SoLV %" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="calls" stroke="#60a5fa" name="Calls" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="websiteClicks" stroke="#a78bfa" name="Clicks" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {result.competitorShifts.length > 0 && (
            <Card className={cardSurface}>
              <CardHeader>
                <CardTitle className={titleText}>Movers & Shakers</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-200 dark:border-slate-800">
                      <TableHead className={mutedText}>Business</TableHead>
                      <TableHead className={mutedText}>Prev</TableHead>
                      <TableHead className={mutedText}>Now</TableHead>
                      <TableHead className={mutedText}>Δ</TableHead>
                      <TableHead className={mutedText}>Cells</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.competitorShifts.map(shift => (
                      <TableRow key={shift.businessName} className="border-zinc-200 dark:border-slate-800">
                        <TableCell className="text-zinc-800 dark:text-slate-200">{shift.businessName}</TableCell>
                        <TableCell className={mutedText}>{shift.previousRank ?? '—'}</TableCell>
                        <TableCell className={mutedText}>{shift.currentRank ?? '—'}</TableCell>
                        <TableCell
                          className={
                            shift.delta > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {shift.delta > 0 ? '+' : ''}
                          {shift.delta}
                        </TableCell>
                        <TableCell className={mutedText}>{shift.cellsAffected}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {result.spamRadar.length > 0 && (
            <Card className={cardSurface}>
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${titleText}`}>
                  <Radar className="h-5 w-5 text-red-500 dark:text-red-400" />
                  GBP Spam Radar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.spamRadar.map(entry => (
                  <div
                    key={entry.businessName}
                    className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-800 dark:text-slate-200">
                        {entry.businessName}
                      </span>
                      <span
                        className={`text-xs uppercase ${
                          entry.severity === 'high'
                            ? 'text-red-600 dark:text-red-400'
                            : entry.severity === 'medium'
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-yellow-600 dark:text-yellow-400'
                        }`}
                      >
                        {entry.severity}
                      </span>
                    </div>
                    <p className={`mt-1 text-sm ${mutedText}`}>{entry.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {result.perplexityRecs.length > 0 && (
            <Card className={cardSurface}>
              <CardHeader>
                <CardTitle className={titleText}>Omni-Engine AI Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.perplexityRecs.map(rec => (
                  <div
                    key={rec.rank}
                    className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <span className="text-xs text-emerald-600 dark:text-blue-400">#{rec.rank}</span>
                    <p className="font-medium text-zinc-800 dark:text-slate-200">{rec.title}</p>
                    <p className={`text-sm ${mutedText}`}>{rec.summary}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">{rec.source}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
