/**
 * CSV streaming parse helpers — BOM strip, formula sanitize, capacity halt.
 * Prefer papaparse when available; fallback parser for zero-dep safety.
 */

import { sanitizeIngestedText } from './sanitize-ingest';
import {
  fuzzyHeaderMatch,
  PROMPT_HEADER_ALIASES,
  CLUSTER_HEADER_ALIASES,
  LOCATION_HEADER_ALIASES,
  sanitizeCsvCell,
  stripBom,
} from './utils';

export type CsvColumnMapping = {
  prompt: string | null;
  cluster: string | null;
  location: string | null;
};

export type CsvParsedRow = {
  prompt: string;
  cluster: string;
  locationRaw: string;
};

export function detectColumnMapping(headers: string[]): CsvColumnMapping {
  const prompt =
    headers.find((h) => fuzzyHeaderMatch(h, PROMPT_HEADER_ALIASES)) ?? null;
  const cluster =
    headers.find((h) => fuzzyHeaderMatch(h, CLUSTER_HEADER_ALIASES)) ?? null;
  const location =
    headers.find((h) => fuzzyHeaderMatch(h, LOCATION_HEADER_ALIASES)) ?? null;
  return { prompt, cluster, location };
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

/**
 * Stream-ish CSV parse — halts when capacityReached returns true.
 * Strips BOM, empty rows, formula injection; main-thread sanitize after parse.
 */
export function parseCsvTextStreaming(opts: {
  text: string;
  delimiter?: string;
  hasHeaders?: boolean;
  mapping?: CsvColumnMapping;
  applyDefaultGeoConsent?: boolean;
  capacityHalt: () => boolean;
  onRow: (row: CsvParsedRow) => void;
}): { headers: string[]; rowsAccepted: number; halted: boolean } {
  const delimiter = opts.delimiter || ',';
  const raw = stripBom(opts.text);
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rowsAccepted: 0, halted: false };
  }

  const hasHeaders = opts.hasHeaders !== false;
  let headers = hasHeaders
    ? splitCsvLine(lines[0]!, delimiter).map((h) => h.trim())
    : ['prompt', 'cluster', 'location'];
  const dataLines = hasHeaders ? lines.slice(1) : lines;

  if (dataLines.length === 0) {
    throw new Error('CSV appears header-only (0 data rows)');
  }

  const mapping = opts.mapping ?? detectColumnMapping(headers);
  const promptIdx = mapping.prompt
    ? headers.findIndex((h) => h === mapping.prompt)
    : 0;
  const clusterIdx = mapping.cluster
    ? headers.findIndex((h) => h === mapping.cluster)
    : headers.findIndex((h) => /cluster|category/i.test(h));
  const locationIdx = mapping.location
    ? headers.findIndex((h) => h === mapping.location)
    : headers.findIndex((h) => /geo|location|market|country/i.test(h));

  let rowsAccepted = 0;
  let halted = false;

  for (const line of dataLines) {
    if (opts.capacityHalt()) {
      halted = true;
      break;
    }
    const cells = splitCsvLine(line, delimiter).map((c) =>
      sanitizeCsvCell(c.trim())
    );
    if (cells.every((c) => !c)) continue;

    const promptRaw = cells[promptIdx >= 0 ? promptIdx : 0] ?? '';
    const prompt = sanitizeIngestedText(promptRaw);
    if (!prompt) continue;

    const cluster = sanitizeIngestedText(
      cells[clusterIdx >= 0 ? clusterIdx : -1] ?? ''
    );
    const locationRaw = sanitizeIngestedText(
      cells[locationIdx >= 0 ? locationIdx : -1] ?? ''
    );

    opts.onRow({
      prompt,
      cluster: cluster || 'Uncategorized',
      locationRaw,
    });
    rowsAccepted += 1;
  }

  return { headers, rowsAccepted, halted };
}

export const CSV_TEMPLATE = `prompt,cluster,location
best emergency plumber near me,Local Services,Seattle, WA
how to choose a sump pump,How-To Intent,US - National
top rated HVAC companies,Product Comparison,Global / National
`;
