'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useAnalysis } from '@/components/analysis/AnalysisProvider';
import ReportExportGateDialog from '@/components/reports/ReportExportGateDialog';
import { Button } from '@/components/ui/button';
import type { AuditData } from '@/lib/audit-data';
import { getReadabilityScore, getTopSemanticGaps } from '@/lib/analysis-state';
import { useGuardedReportExport } from '@/hooks/useGuardedReportExport';
import { cn } from '@/lib/utils';

type DownloadPdfButtonProps = {
  auditId: number;
  url: string;
  targetKeyword: string;
  geoScore: number;
  createdAt: string;
  data: AuditData;
  className?: string;
};

export default function DownloadPdfButton({
  auditId,
  url,
  targetKeyword,
  geoScore,
  createdAt,
  data,
  className,
}: DownloadPdfButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { technicalData, semanticData, matchesSession } = useAnalysis();
  const { branding, gateOpen, gateMessage, setGateOpen, runExport, confirmExport } =
    useGuardedReportExport();

  const sessionMatches = matchesSession(url, targetKeyword);
  const readabilityScore = sessionMatches ? getReadabilityScore(technicalData) : null;
  const semanticResult = sessionMatches ? semanticData?.semanticResult ?? null : null;
  const semanticGaps = getTopSemanticGaps(semanticResult);
  const hasSemanticAnalysis = sessionMatches && semanticResult !== null;

  async function handleDownload() {
    runExport(async () => {
      setLoading(true);
      setError(null);

      try {
        const { buildAuditPdfFilename, generateAuditPdfBlob } = await import('@/lib/pdf-generator');

        const blob = await generateAuditPdfBlob({
          url,
          targetKeyword,
          geoScore,
          createdAt: new Date(createdAt),
          data,
          readabilityScore,
          semanticGaps,
          hasSemanticAnalysis,
          branding,
        });

        const filename = buildAuditPdfFilename(targetKeyword, auditId);
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(downloadUrl);
      } catch (downloadError) {
        setError(
          downloadError instanceof Error ? downloadError.message : 'Download failed. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    });
  }

  return (
    <div className={cn('flex flex-col items-end gap-1.5', className)}>
      <ReportExportGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        message={gateMessage}
        onConfirm={confirmExport}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleDownload}
        disabled={loading}
        className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 dark:border-white/20 dark:bg-white/95 dark:text-blue-700 dark:shadow-md dark:hover:bg-white dark:hover:text-blue-800"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Download PDF
      </Button>
      {error && <p className="text-xs text-red-600 dark:text-red-200">{error}</p>}
    </div>
  );
}
