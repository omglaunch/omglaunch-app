import type { AnalysisMetrics } from '@/lib/analysis-data';

export async function fetchPageAnalysis(url: string): Promise<AnalysisMetrics> {
  const response = await fetch('/api/analysis-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Failed to run technical analysis');
  }

  return response.json() as Promise<AnalysisMetrics>;
}
