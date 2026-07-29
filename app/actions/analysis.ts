"use server";

import { runPageAnalysis as runPageAnalysisImpl } from '@/lib/analysis/run-page-analysis';
import type { AnalysisMetrics } from '@/lib/analysis-data';

export async function runPageAnalysis(url: string): Promise<AnalysisMetrics> {
  return runPageAnalysisImpl(url);
}
