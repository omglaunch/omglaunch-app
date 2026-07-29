import type {
  Assignee,
  Diagnosis,
  KeywordVariant,
  OptimizationGap,
  RevenueRescueRow,
  Segment,
  TrendPoint,
} from '@/lib/revenue-rescue/types';
import { DIAGNOSES, OPTIMIZATION_GAPS } from '@/lib/revenue-rescue/types';
import {
  aggregateByCanonicalUrl,
  clampDeltaPct,
  deriveTrafficMetrics,
} from '@/lib/revenue-rescue/utils';

const SILOS = [
  'Home Services',
  'Local Guides',
  'Product Reviews',
  'How-To Hub',
  'Comparisons',
  'Industry News',
  'Tools & Calculators',
  'Case Studies',
];

const PATH_ROOTS = [
  '/blog',
  '/guides',
  '/services',
  '/reviews',
  '/compare',
  '/tools',
  '/resources',
  '/local',
];

const KEYWORD_STEMS = [
  'emergency plumber',
  'roof repair cost',
  'best HVAC companies',
  'how to fix',
  'near me',
  'vs',
  'pricing guide',
  'installation tips',
  'maintenance checklist',
  'diy vs pro',
  'warranty coverage',
  'seasonal prep',
  'energy savings',
  'permit requirements',
  'contractor checklist',
];

const LOCATIONS = [
  'austin',
  'dallas',
  'houston',
  'denver',
  'phoenix',
  'seattle',
  'miami',
  'chicago',
  'atlanta',
  'portland',
];

const TOPICS = [
  'water-heater',
  'ac-unit',
  'garage-door',
  'furnace',
  'sump-pump',
  'gutters',
  'insulation',
  'ductwork',
  'thermostat',
  'water-softener',
];

const CORE_UPDATE_LABELS = [
  'Google March Core Update',
  'Google November Core Update',
  'Google August Core Update',
];

const ASSIGNEES: Assignee[] = [
  { id: 'a1', name: 'Maya Chen', initials: 'MC', color: 'bg-emerald-600' },
  { id: 'a2', name: 'Jordan Lee', initials: 'JL', color: 'bg-sky-600' },
  { id: 'a3', name: 'Sam Ortiz', initials: 'SO', color: 'bg-amber-600' },
  { id: 'a4', name: 'Riley Park', initials: 'RP', color: 'bg-violet-600' },
  { id: 'a5', name: 'Alex Kim', initials: 'AK', color: 'bg-rose-600' },
];

function seeded(n: number): () => number {
  let s = n >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build a declining (or flat-to-declining) 90-day series that ends near `current`
 * and never invents a recovery above peak.
 */
function buildDecayTrend(
  rand: () => number,
  peak: number,
  current: number,
  coreUpdateDay: number | null,
  fixDay: number | null
): TrendPoint[] {
  const points: TrendPoint[] = [];
  const days = 90;
  const safePeak = Math.max(peak, current + 1);
  const safeCurrent = Math.min(current, safePeak - 1);

  for (let day = 0; day < days; day++) {
    let base: number;
    if (coreUpdateDay != null && day >= coreUpdateDay) {
      const t = (day - coreUpdateDay) / Math.max(1, days - 1 - coreUpdateDay);
      base = safePeak + (safeCurrent - safePeak) * Math.min(1, t);
    } else {
      // Pre-update: hover near peak
      base = safePeak * (0.94 + rand() * 0.06);
    }

    // Mild recovery after fix — still stays below peak and usually below pre-drop midpoints
    if (fixDay != null && day >= fixDay) {
      const recovery = (day - fixDay) / Math.max(1, days - 1 - fixDay);
      const ceiling = safeCurrent + (safePeak - safeCurrent) * 0.25;
      base = safeCurrent + (ceiling - safeCurrent) * recovery;
    }

    const noise = 1 + (rand() - 0.5) * 0.06;
    const clicks = Math.max(
      0,
      Math.min(safePeak, Math.round(base * noise))
    );
    const benchmark = Math.round(safePeak * (0.85 + Math.sin(day / 12) * 0.04));
    points.push({ day, clicks, benchmark });
  }

  // Force last point to match current clicks so sparkline aligns with metrics
  if (points.length) {
    points[points.length - 1] = {
      ...points[points.length - 1]!,
      clicks: safeCurrent,
    };
  }

  return points;
}

function buildVariants(
  rand: () => number,
  primary: string,
  totalClicks: number
): KeywordVariant[] {
  const count = 1 + Math.floor(rand() * 5);
  const variants: KeywordVariant[] = [];
  let remaining = Math.max(1, totalClicks);
  for (let i = 0; i < count; i++) {
    const isPrimary = i === 0;
    const share = isPrimary
      ? 0.45 + rand() * 0.35
      : rand() * (remaining / Math.max(1, totalClicks));
    const clicks = Math.max(
      1,
      Math.round(totalClicks * Math.min(share, remaining / Math.max(1, totalClicks)))
    );
    remaining = Math.max(0, remaining - clicks);
    const keyword = isPrimary
      ? primary
      : `${primary} ${pick(rand, ['cost', 'near me', '2026', 'guide', 'tips'])}`;
    variants.push({
      keyword,
      clicks,
      impressions: clicks * (8 + Math.floor(rand() * 40)),
    });
  }
  return variants.sort((a, b) => b.clicks - a.clicks);
}

function pickGaps(rand: () => number): OptimizationGap[] {
  const count = 1 + Math.floor(rand() * 2);
  const shuffled = [...OPTIMIZATION_GAPS].sort(() => rand() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Generates a large GSC-like dataset with intentional URL fragmentation
 * (same canonical with variant query strings) so aggregation can be demonstrated.
 */
export function generateRevenueRescueDataset(
  count = 5200,
  avgConversionValue = 48
): RevenueRescueRow[] {
  const rand = seeded(20260713);
  const raw: RevenueRescueRow[] = [];

  for (let i = 0; i < count; i++) {
    const topic = pick(rand, TOPICS);
    const location = pick(rand, LOCATIONS);
    const pathRoot = pick(rand, PATH_ROOTS);
    const silo = pick(rand, SILOS);
    const stem = pick(rand, KEYWORD_STEMS);
    const targetKeyword = `${stem} ${location} ${topic}`.replace(/\s+/g, ' ');
    const path = `${pathRoot}/${slugify(topic)}-${location}-${i}`;
    const fragment =
      rand() > 0.85
        ? `?utm_source=${pick(rand, ['gsc', 'email', 'social'])}&ref=${Math.floor(rand() * 9)}`
        : '';
    const canonicalUrl = `https://example.com${path}`;
    const displayUrl = `${canonicalUrl}${fragment}`;

    // Only reuse prior rows from the SAME segment so aggregation never mixes metrics
    const reusePrior = i > 20 && rand() > 0.92;
    let finalDisplay = displayUrl;
    let reuseSegment: Segment | null = null;
    if (reusePrior) {
      const candidates = raw.slice(Math.max(0, i - 200), i);
      const prior = candidates[Math.floor(rand() * candidates.length)];
      if (prior) {
        reuseSegment = prior.segment;
        finalDisplay = `${prior.canonicalUrl.split('?')[0]}?utm_campaign=gsc-fragment-${i}`;
      }
    }

    const segment: Segment =
      reuseSegment ?? (rand() > 0.55 ? 'content-decay' : 'striking-distance');
    const diagnosis: Diagnosis = pick(rand, DIAGNOSES);

    // Content decay: peak always > current; drop between 15–75%
    const peakClicks = 80 + Math.floor(rand() * 920);
    const dropFactor =
      segment === 'content-decay'
        ? 0.25 + rand() * 0.5 // current = 25–75% of peak
        : 0.7 + rand() * 0.25; // striking: milder dip for trend only
    const currentClicks = Math.max(
      1,
      Math.min(peakClicks - 1, Math.round(peakClicks * dropFactor))
    );
    const { trafficDelta, trafficDeltaPct } = deriveTrafficMetrics(
      peakClicks,
      currentClicks
    );
    const engagementDeltaPct = -(5 + Math.floor(rand() * 28));

    const coreUpdateDay =
      segment === 'content-decay' && rand() > 0.25
        ? 28 + Math.floor(rand() * 30)
        : null;
    const coreUpdateLabel =
      coreUpdateDay != null ? pick(rand, CORE_UPDATE_LABELS) : null;

    const statusRoll = rand();
    let status: RevenueRescueRow['status'] = 'open';
    let monitoringDay: number | null = null;
    let processedAt: string | null = null;
    let fixDay: number | null = null;

    if (statusRoll > 0.82) {
      status = 'monitoring';
      monitoringDay = 1 + Math.floor(rand() * 27);
      processedAt = new Date(
        Date.now() - monitoringDay * 24 * 60 * 60 * 1000
      ).toISOString();
      fixDay = 70 + Math.floor(rand() * 15);
    } else if (statusRoll > 0.74) {
      status = 're-evaluation';
      processedAt = new Date(
        Date.now() - (30 + Math.floor(rand() * 20)) * 24 * 60 * 60 * 1000
      ).toISOString();
      fixDay = 55 + Math.floor(rand() * 10);
    } else if (statusRoll > 0.7) {
      status = 'seasonal';
    } else if (statusRoll > 0.67) {
      status = 'ignored';
    }

    const trend = buildDecayTrend(
      rand,
      peakClicks,
      currentClicks,
      coreUpdateDay,
      fixDay
    );
    const variants = buildVariants(rand, targetKeyword, currentClicks);
    const estimatedRevenueAtRisk = Math.round(
      Math.abs(Math.min(0, trafficDelta)) * avgConversionValue * 0.02
    );

    // Striking distance: true band is positions 11–25 (inclusive)
    const currentRank = 11 + Math.floor(rand() * 15); // 11..25
    const searchVolume = 400 + Math.floor(rand() * 24000);
    const estTrafficGain = Math.max(
      40,
      Math.round(
        searchVolume * ((26 - currentRank) / 110) * (0.45 + rand() * 0.55)
      )
    );
    const optimizationGaps = pickGaps(rand);

    const assignee =
      status === 'monitoring' || rand() > 0.65 ? pick(rand, ASSIGNEES) : null;

    raw.push({
      id: `rr-${i}-${slugify(path)}`,
      canonicalUrl: finalDisplay,
      path,
      silo,
      targetKeyword: variants[0]?.keyword ?? targetKeyword,
      variants,
      segment,
      diagnosis,
      competitorContext:
        rand() > 0.4 ? 'vs Competitors: Stable' : 'vs Competitors: Rising',
      peakClicks,
      currentClicks,
      trafficDelta,
      trafficDeltaPct: clampDeltaPct(trafficDeltaPct),
      engagementDeltaPct,
      estimatedRevenueAtRisk,
      currentRank,
      searchVolume,
      estTrafficGain,
      optimizationGaps,
      trend,
      coreUpdateDay,
      fixDay,
      coreUpdateLabel,
      status,
      monitoringDay,
      processedAt,
      assignee,
      diagnosisLoading: i < 12 && rand() > 0.85,
    });
  }

  const normalized = raw.map((row) => {
    try {
      const u = new URL(row.canonicalUrl);
      u.search = '';
      u.hash = '';
      return { ...row, canonicalUrl: u.toString().replace(/\/$/, '') };
    } catch {
      return row;
    }
  });

  return aggregateByCanonicalUrl(normalized).sort(
    (a, b) => a.trafficDelta - b.trafficDelta
  );
}

export { ASSIGNEES };
