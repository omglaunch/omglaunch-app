'use client';

import { useState, type RefObject } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CompetitorCompareResult } from '@/lib/competitor-compare-data';
import ReportExportGateDialog from '@/components/reports/ReportExportGateDialog';
import { useGuardedReportExport } from '@/hooks/useGuardedReportExport';
import { cn } from '@/lib/utils';

type ExportMarketReportButtonProps = {
  result: CompetitorCompareResult;
  reportRef: RefObject<HTMLElement | null>;
  className?: string;
};

export default function ExportMarketReportButton({
  result,
  reportRef,
  className,
}: ExportMarketReportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { branding, gateOpen, gateMessage, setGateOpen, runExport, confirmExport } =
    useGuardedReportExport();

  async function handleExport() {
    const element = reportRef.current;

    if (!element) {
      setError('Report content is not ready for export yet.');
      return;
    }

    runExport(async () => {
      setLoading(true);
      setError(null);

      try {
        const { buildCompetitorComparePdfFilename, generateCompetitorCompareCanvasPdf } =
          await import('@/lib/competitor-compare-canvas-pdf');

        const blob = await generateCompetitorCompareCanvasPdf(element, {
          branding,
          targetKeyword: result.targetKeyword,
          targetUrl: result.yourPage?.url ?? null,
          analyzedAt: result.analyzedAt,
        });
        const filename = buildCompetitorComparePdfFilename(result.targetKeyword);
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(downloadUrl);
      } catch (exportError) {
        console.error('[ExportMarketReportButton] PDF export failed:', exportError);
        setError(
          exportError instanceof Error ? exportError.message : 'Export failed. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    });
  }

  return (
    <div className={cn('flex flex-col items-end gap-1.5', className)} data-pdf-exclude>
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
        onClick={handleExport}
        disabled={loading}
        className="border-emerald-500/40 bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Export Market Report PDF
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
