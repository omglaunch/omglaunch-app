import type { GridCell, CompetitorShift, GeogridRunInput, GeogridRunResult, TrendDataPoint } from './types';
import {
  buildGridCoordinates,
  buildLocationCoordinate,
  computeSaiv,
  computeSolv,
  emptyGridCell,
} from './grid-utils';
import { fetchMapsGeogridBatch, resolveDataForSeoCredentials } from './dataforseo-maps';
import { resolveCentralGps } from './resolve-central-gps';
import {
  runGeminiSpamRadar,
  runMicroGridVisibility,
  runPerplexityMacroScorecard,
} from './llm-engines';
import { fetchGbpPerformanceMetrics } from '@/lib/google/gbp-oauth';
import { getPrisma } from '@/lib/prisma';
import { deductCredits } from '@/lib/credits';
import { GEOGRID_CREDIT_COSTS, SOLV_ANOMALY_THRESHOLD } from './constants';
import { resolveLlmCredential } from '@/lib/llm/credentials';

function cellTag(row: number, col: number): string {
  return `${row}-${col}`;
}

function computeCompetitorShifts(
  currentCells: GridCell[],
  previousGrid: GridCell[] | null
): CompetitorShift[] {
  if (!previousGrid?.length) return [];

  const shifts = new Map<string, CompetitorShift>();

  for (const cell of currentCells) {
    const prev = previousGrid.find(p => p.row === cell.row && p.col === cell.col);
    for (const entry of cell.mapPack) {
      const key = entry.cid ?? entry.title;
      const existing = shifts.get(key) ?? {
        businessName: entry.title,
        cid: entry.cid,
        previousRank: prev?.mapPack.find(e => (e.cid ?? e.title) === key)?.rank ?? null,
        currentRank: entry.rank,
        delta: 0,
        cellsAffected: 0,
      };
      existing.currentRank = entry.rank;
      existing.cellsAffected += 1;
      if (existing.previousRank !== null) {
        existing.delta = existing.previousRank - entry.rank;
      }
      shifts.set(key, existing);
    }
  }

  return Array.from(shifts.values())
    .filter(s => s.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 20);
}

function buildTrendData(
  solvScore: number,
  gbpMetrics: GeogridRunResult['gbpMetrics'],
  previousTrend: TrendDataPoint[] | null
): TrendDataPoint[] {
  const today = new Date().toISOString().slice(0, 10);
  const point: TrendDataPoint = {
    date: today,
    solv: solvScore,
    calls: gbpMetrics?.calls ?? 0,
    websiteClicks: gbpMetrics?.websiteClicks ?? 0,
  };

  const history = previousTrend ?? [];
  const withoutToday = history.filter(h => h.date !== today);
  return [...withoutToday, point].slice(-30);
}

export async function executeGeogridRun(
  workspaceId: string,
  userId: string,
  input: GeogridRunInput,
  options?: { skipCreditDeduction?: boolean }
): Promise<GeogridRunResult> {
  const credentials = await resolveDataForSeoCredentials(workspaceId);
  if (!credentials) {
    throw new Error('DataForSEO credentials are not configured');
  }

  const openAiCred = await resolveLlmCredential(workspaceId, 'openai');
  const usesMasterKeys = openAiCred?.usesCredits ?? true;

  if (usesMasterKeys && !options?.skipCreditDeduction) {
    await deductCredits(userId, GEOGRID_CREDIT_COSTS[input.gridSize], 'LOCAL_DOMINANCE_GEOGRID');
  }

  const resolvedCenter = await resolveCentralGps(credentials, {
    keyword: input.keyword,
    businessName: input.businessName,
    businessCid: input.businessCid,
    centralLat: input.centralLat,
    centralLng: input.centralLng,
    platform: input.platform,
  });

  const coordinates = buildGridCoordinates(
    resolvedCenter.lat,
    resolvedCenter.lng,
    input.radiusKm,
    input.gridSize
  );

  const tasks = coordinates.map(coord => ({
    keyword: input.keyword,
    location_coordinate: buildLocationCoordinate(
      coord.lat,
      coord.lng,
      input.platform,
      { radiusKm: input.radiusKm, gridSize: input.gridSize }
    ),
    language_code: 'en',
    device: 'desktop',
    depth: 3,
    tag: cellTag(coord.row, coord.col),
  }));

  const mapsResults = await fetchMapsGeogridBatch(
    tasks,
    credentials,
    input.platform,
    { businessCid: input.businessCid, businessName: input.businessName }
  );

  let cells: GridCell[] = coordinates.map(coord => {
    const result = mapsResults.find(r => r.tag === cellTag(coord.row, coord.col));
    const base = emptyGridCell(coord.row, coord.col, coord.lat, coord.lng);
    if (!result) return base;
    return {
      ...base,
      rank: result.targetRank,
      businessName: result.targetName,
      cid: result.targetCid,
      mapPack: result.mapPack,
    };
  });

  cells = await runMicroGridVisibility(
    workspaceId,
    input.keyword,
    cells,
    input.businessName
  );

  const [perplexityRecs, prisma] = await Promise.all([
    runPerplexityMacroScorecard(
      workspaceId,
      input.keyword,
      `${resolvedCenter.lat},${resolvedCenter.lng}`
    ),
    Promise.resolve(getPrisma()),
  ]);

  const integration = await prisma.integrationConfig.findFirst({
    where: { workspaceId },
    select: { googleBusinessProfileLocationId: true },
  });

  const endDate = input.dateRangeEnd ?? new Date().toISOString().slice(0, 10);
  const startDate =
    input.dateRangeStart ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const gbpMetrics = integration?.googleBusinessProfileLocationId
    ? await fetchGbpPerformanceMetrics(
        workspaceId,
        integration.googleBusinessProfileLocationId,
        startDate,
        endDate
      )
    : null;

  const solvScore = computeSolv(cells, input.businessCid, input.businessName);
  const saivScore = computeSaiv(cells);

  const competitorNames = Array.from(
    new Set(cells.flatMap(c => c.mapPack.map(e => e.title)))
  ).slice(0, 15);

  const spamRadar = await runGeminiSpamRadar(workspaceId, competitorNames, input.keyword);

  const previousAudit = await prisma.localAuditHistory.findFirst({
    where: { workspaceId, projectId: input.projectId, keyword: input.keyword },
    orderBy: { createdAt: 'desc' },
    select: { gridResults: true, trendData: true, solvScore: true },
  });

  const previousGrid = previousAudit?.gridResults as GridCell[] | null;
  const competitorShifts = computeCompetitorShifts(cells, previousGrid);
  const trendData = buildTrendData(
    solvScore,
    gbpMetrics,
    (previousAudit?.trendData as TrendDataPoint[] | null) ?? null
  );

  if (
    previousAudit?.solvScore != null &&
    solvScore < previousAudit.solvScore * (1 - SOLV_ANOMALY_THRESHOLD)
  ) {
    console.warn(
      `[local-dominance] SoLV anomaly: dropped from ${previousAudit.solvScore}% to ${solvScore}%`
    );
  }

  const audit = await prisma.localAuditHistory.create({
    data: {
      workspaceId,
      projectId: input.projectId,
      keyword: input.keyword,
      centralLat: resolvedCenter.lat,
      centralLng: resolvedCenter.lng,
      radiusKm: input.radiusKm,
      gridSize: input.gridSize,
      platform: input.platform,
      businessName: input.businessName,
      businessCid: input.businessCid,
      solvScore,
      saivScore,
      gridResults: cells as unknown as object,
      aiVisibility: { microGrid: true, saivScore },
      perplexityRecs: perplexityRecs as unknown as object,
      gbpMetrics: gbpMetrics as unknown as object,
      spamRadar: spamRadar as unknown as object,
      competitorShifts: competitorShifts as unknown as object,
      trendData: trendData as unknown as object,
      scheduled: input.scheduleRun ?? false,
    },
  });

  if (input.scheduleRun) {
    await prisma.cronSchedule.create({
      data: {
        workspaceId,
        projectId: input.projectId,
        keyword: input.keyword,
        centralLat: resolvedCenter.lat,
        centralLng: resolvedCenter.lng,
        radiusKm: input.radiusKm,
        gridSize: input.gridSize,
        platform: input.platform,
        businessName: input.businessName,
        businessCid: input.businessCid,
        frequency: input.scheduleFrequency ?? 'WEEKLY',
        nextRunAt: computeNextRunAt(input.scheduleFrequency ?? 'WEEKLY'),
        lastSolvScore: solvScore,
      },
    });
  }

  return {
    auditId: audit.id,
    shareToken: audit.shareToken,
    solvScore,
    saivScore,
    gridResults: cells,
    resolvedCenter,
    aiVisibility: { microGrid: true, saivScore },
    perplexityRecs,
    gbpMetrics,
    spamRadar,
    competitorShifts,
    trendData,
  };
}

function computeNextRunAt(frequency: string): Date {
  const now = new Date();
  if (frequency === 'DAILY') {
    now.setDate(now.getDate() + 1);
  } else if (frequency === 'MONTHLY') {
    now.setMonth(now.getMonth() + 1);
  } else {
    now.setDate(now.getDate() + 7);
  }
  return now;
}
