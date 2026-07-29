/**
 * Approximate DataForSEO Labs cost for keyword overview + optional bulk KD.
 * Pricing model: ~$0.012 / task + ~$0.00012 / returned item.
 */
const LABS_TASK_FEE = 0.012;
const LABS_ITEM_FEE = 0.00012;
const OVERVIEW_BATCH_SIZE = 100;

export function estimateLabsKeywordMetricsCostUsd(keywordCount: number): number {
  if (keywordCount <= 0) {
    return 0;
  }

  const overviewTasks = Math.ceil(keywordCount / OVERVIEW_BATCH_SIZE);
  // Worst case: one bulk KD task after overview still missing KD.
  const bulkKdTasks = 1;
  const tasks = overviewTasks + bulkKdTasks;
  const items = keywordCount * 2;

  return Number((tasks * LABS_TASK_FEE + items * LABS_ITEM_FEE).toFixed(4));
}

export function formatLabsCostEstimateUsd(keywordCount: number): string {
  const cost = estimateLabsKeywordMetricsCostUsd(keywordCount);
  if (cost <= 0) {
    return '$0';
  }
  if (cost < 0.01) {
    return '<$0.01';
  }
  return `~$${cost.toFixed(2)}`;
}
