'use client';

import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildSiloExportFilename, downloadBlob } from '@/lib/silo-builder/export-utils';
import { createSiloNodesCsvBlob } from '@/lib/silo-builder/export-csv';
import { createSiloProjectJsonBlob } from '@/lib/silo-builder/export-json';
import type { SiloProjectDto } from '@/lib/silo-builder/types';
import { toast } from '@/components/ui/sonner';

type ExportFormat = 'json' | 'csv' | 'pdf';

type SiloExportMenuProps = {
  project: SiloProjectDto;
};

export default function SiloExportMenu({ project }: SiloExportMenuProps) {
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  async function handleExport(format: ExportFormat) {
    setExportingFormat(format);

    try {
      if (format === 'json') {
        const blob = createSiloProjectJsonBlob(project);
        downloadBlob(blob, buildSiloExportFilename(project.title, 'json'));
        toast.success('JSON export downloaded.');
        return;
      }

      if (format === 'csv') {
        const blob = createSiloNodesCsvBlob(project.title, project.nodes);
        downloadBlob(blob, buildSiloExportFilename(project.title, 'csv'));
        toast.success('CSV export downloaded.');
        return;
      }

      const { generateSiloProjectPdfBlob } = await import('@/lib/silo-builder/export-pdf');
      const blob = await generateSiloProjectPdfBlob(project);
      downloadBlob(blob, buildSiloExportFilename(project.title, 'pdf'));
      toast.success('PDF strategy report downloaded.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Export failed. Please try again.'
      );
    } finally {
      setExportingFormat(null);
    }
  }

  const isExporting = exportingFormat !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isExporting}
          className="gap-1.5"
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Structured exports</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isExporting}
          onClick={() => void handleExport('json')}
          className="gap-2"
        >
          <FileJson className="h-4 w-4" />
          JSON (full project)
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isExporting}
          onClick={() => void handleExport('csv')}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          CSV (node table)
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isExporting}
          onClick={() => void handleExport('pdf')}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          PDF (strategy report)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
