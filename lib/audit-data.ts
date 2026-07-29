export type ActionPlanItem = {
  title: string;
  reasoning: string;
  currentText: string;
  suggestedText: string;
};

export type AuditData = {
  title?: string;
  headings?: string[];
  wordCount?: number;
  images?: {
    total: number;
    missingAlt: number;
  };
  targetKeyword?: string;
  analysis?: string;
  actionPlan?: ActionPlanItem[];
  bonusTip?: string;
};

export function parseAuditData(auditData: unknown): AuditData {
  if (auditData && typeof auditData === 'object') {
    return auditData as AuditData;
  }
  return {};
}

export function scoreColorClass(score: number) {
  if (score >= 80) return { ring: 'stroke-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (score >= 60) return { ring: 'stroke-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
  return { ring: 'stroke-red-500', text: 'text-red-600', bg: 'bg-red-50' };
}

export function scoreBadgeClass(score: number) {
  if (score >= 80) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (score >= 60) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}
