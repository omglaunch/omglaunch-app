'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { AnalysisMetrics } from '@/lib/analysis-data';
import ReportExportGateDialog from '@/components/reports/ReportExportGateDialog';
import { useGuardedReportExport } from '@/hooks/useGuardedReportExport';
import { cn } from '@/lib/utils';

type AnalysisDownloadPdfButtonProps = {
  metrics: AnalysisMetrics;
  disabled?: boolean;
  className?: string;
};

export default function AnalysisDownloadPdfButton({
  metrics,
  disabled = false,
  className,
}: AnalysisDownloadPdfButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { branding, gateOpen, gateMessage, setGateOpen, runExport, confirmExport } =
    useGuardedReportExport();

  async function handleDownload() {
    runExport(async () => {
      setLoading(true);
      setError(null);

      try {
        const { buildAnalysisPdfFilename, generateAnalysisPdfBlob } = await import(
          '@/lib/analysis-pdf-generator'
        );

        const blob = await generateAnalysisPdfBlob(metrics, branding);
        const filename = buildAnalysisPdfFilename(metrics.url);
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
    <div className={cn('flex flex-col items-end gap-1', className)}>
      <ReportExportGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        message={gateMessage}
        onConfirm={confirmExport}
      />
      <button
        type="button"
        onClick={handleDownload}
        disabled={disabled || loading}
        className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-200 dark:bg-blue-50 dark:text-blue-700 dark:hover:bg-blue-100"
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Download size={15} />
        )}
        Download the PDF
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
