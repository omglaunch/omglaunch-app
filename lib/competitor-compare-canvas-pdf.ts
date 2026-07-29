import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  formatReportBrandingLines,
  type ReportBranding,
} from '@/lib/projects/client-brand-shared';

const CAPTURE_WIDTH_PX = 1200;
const CANVAS_SCALE = 2;
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const PDF_EXPORT_TIMEOUT_MS = 60_000;
const JPEG_QUALITY = 0.75;

const AVOID_BREAK_SELECTORS = 'tr, .strategy-box, .gap-row, .semantic-row';

export type CompetitorCompareCanvasPdfOptions = {
  branding?: ReportBranding;
  targetKeyword?: string;
  targetUrl?: string | null;
  analyzedAt?: string;
};

const PDF_COLORS = {
  primary: [37, 99, 235] as const,
  slate900: [17, 24, 39] as const,
  slate500: [107, 114, 128] as const,
  slate700: [55, 65, 81] as const,
};

export function buildCompetitorComparePdfFilename(keyword: string): string {
  const slug = (keyword || 'market-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `competitor-geo-audit-${slug || 'report'}.pdf`;
}

type StyleSnapshot = {
  width: string;
  maxWidth: string;
  height: string;
  minHeight: string;
  boxSizing: string;
  overflow: string;
  wordBreak: string;
  hadPrintMode: boolean;
  hadDarkMode: boolean;
};

type AvoidRange = {
  top: number;
  bottom: number;
};

function applyCaptureStyles(element: HTMLElement): StyleSnapshot {
  const htmlEl = document.documentElement;
  const hadDarkMode = htmlEl.classList.contains('dark');

  const snapshot: StyleSnapshot = {
    width: element.style.width,
    maxWidth: element.style.maxWidth,
    height: element.style.height,
    minHeight: element.style.minHeight,
    boxSizing: element.style.boxSizing,
    overflow: element.style.overflow,
    wordBreak: element.style.wordBreak,
    hadPrintMode: element.classList.contains('print-mode'),
    hadDarkMode,
  };

  // Always export in light mode for a professional, print-ready appearance.
  htmlEl.classList.remove('dark');
  element.classList.add('print-mode');

  element.style.width = `${CAPTURE_WIDTH_PX}px`;
  element.style.maxWidth = `${CAPTURE_WIDTH_PX}px`;
  element.style.height = 'auto';
  element.style.minHeight = `${element.scrollHeight}px`;
  element.style.boxSizing = 'border-box';
  element.style.overflow = 'visible';
  element.style.wordBreak = 'break-word';

  element.querySelectorAll<HTMLElement>('table, [class*="grid"]').forEach(node => {
    node.style.maxWidth = '100%';
    node.style.wordBreak = 'break-word';
  });

  element.querySelectorAll<HTMLElement>('.truncate').forEach(node => {
    node.classList.remove('truncate');
    node.style.whiteSpace = 'normal';
    node.style.overflow = 'visible';
    node.style.textOverflow = 'clip';
    node.style.wordBreak = 'break-word';
  });

  element.querySelectorAll<HTMLElement>('.semantic-gaps-table').forEach(node => {
    node.style.whiteSpace = 'normal';
    node.style.overflow = 'visible';
  });

  element.querySelectorAll<HTMLElement>(
    '.semantic-gap-entity-col, .semantic-gap-entity-title, .semantic-gap-entity-subtitle'
  ).forEach(node => {
    node.style.whiteSpace = 'normal';
    node.style.overflow = 'visible';
    node.style.textOverflow = 'clip';
    node.style.wordBreak = 'break-word';
    node.style.lineHeight = '1.35';
    node.style.maxWidth = '320px';
    node.style.minWidth = '220px';
    node.style.width = 'auto';
    node.style.height = 'auto';
    node.style.position = 'static';
    node.style.boxShadow = 'none';
  });

  element.querySelectorAll<HTMLElement>('.semantic-gaps-table tr').forEach(node => {
    node.style.height = 'auto';
    node.style.overflow = 'visible';
  });

  return snapshot;
}

function revertCaptureStyles(element: HTMLElement, snapshot: StyleSnapshot): void {
  element.style.width = snapshot.width;
  element.style.maxWidth = snapshot.maxWidth;
  element.style.height = snapshot.height;
  element.style.minHeight = snapshot.minHeight;
  element.style.boxSizing = snapshot.boxSizing;
  element.style.overflow = snapshot.overflow;
  element.style.wordBreak = snapshot.wordBreak;

  if (!snapshot.hadPrintMode) {
    element.classList.remove('print-mode');
  }

  if (snapshot.hadDarkMode) {
    document.documentElement.classList.add('dark');
  }
}

function hidePdfExcludedElements(element: HTMLElement): Map<HTMLElement, string> {
  const displayMap = new Map<HTMLElement, string>();

  element.querySelectorAll<HTMLElement>('[data-pdf-exclude]').forEach(node => {
    displayMap.set(node, node.style.display);
    node.style.display = 'none';
  });

  return displayMap;
}

function restorePdfExcludedElements(displayMap: Map<HTMLElement, string>): void {
  displayMap.forEach((display, node) => {
    node.style.display = display;
  });
}

function waitForLayout(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function computeAvoidRanges(container: HTMLElement, scale: number): AvoidRange[] {
  const containerRect = container.getBoundingClientRect();
  const ranges: AvoidRange[] = [];

  container.querySelectorAll(AVOID_BREAK_SELECTORS).forEach(node => {
    const rect = node.getBoundingClientRect();
    const top = (rect.top - containerRect.top) * scale;
    const bottom = (rect.bottom - containerRect.top) * scale;

    if (bottom > top) {
      ranges.push({ top, bottom });
    }
  });

  return ranges.sort((a, b) => a.top - b.top);
}

function computePageSliceEnds(
  canvasHeight: number,
  pageHeightPx: number,
  avoidRanges: AvoidRange[]
): number[] {
  const sliceEnds: number[] = [];
  let pageStart = 0;
  const minSlicePx = pageHeightPx * 0.15;

  while (pageStart < canvasHeight - 1) {
    let pageEnd = Math.min(pageStart + pageHeightPx, canvasHeight);

    if (pageEnd < canvasHeight) {
      for (const range of avoidRanges) {
        const wouldSplitRow =
          range.top < pageEnd && range.bottom > pageEnd && range.top >= pageStart;

        if (!wouldSplitRow) {
          continue;
        }

        if (range.top - pageStart >= minSlicePx) {
          pageEnd = range.top;
        } else if (range.bottom - pageStart <= pageHeightPx * 1.05) {
          pageEnd = Math.min(range.bottom, canvasHeight);
        }

        break;
      }
    }

    if (pageEnd <= pageStart) {
      pageEnd = Math.min(pageStart + pageHeightPx, canvasHeight);
    }

    sliceEnds.push(pageEnd);
    pageStart = pageEnd;
  }

  return sliceEnds;
}

function getPageHeightPx(canvas: HTMLCanvasElement): number {
  return (canvas.width * PAGE_HEIGHT_MM) / PAGE_WIDTH_MM;
}

function addBrandingCoverPage(
  pdf: jsPDF,
  options: CompetitorCompareCanvasPdfOptions
): void {
  const brandLines = formatReportBrandingLines(options.branding);
  const keyword = options.targetKeyword?.trim() || 'Market comparison';
  const analyzedAt = options.analyzedAt?.trim()
    ? format(new Date(options.analyzedAt), 'MMMM d, yyyy · h:mm a')
    : format(new Date(), 'MMMM d, yyyy · h:mm a');
  const centerX = PAGE_WIDTH_MM / 2;

  pdf.setProperties({
    title: `Market Report — ${keyword}`,
    subject: brandLines.footerLeft,
    author: brandLines.author,
  });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...PDF_COLORS.primary);
  pdf.text('MULTI-COMPETITOR GEO AUDIT', centerX, 48, { align: 'center' });

  pdf.setFontSize(22);
  pdf.setTextColor(...PDF_COLORS.slate900);
  pdf.text('Market Intelligence Report', centerX, 62, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.setTextColor(...PDF_COLORS.slate700);
  pdf.text(keyword, centerX, 74, { align: 'center', maxWidth: 170 });

  if (options.targetUrl?.trim()) {
    pdf.setFontSize(9);
    pdf.setTextColor(...PDF_COLORS.slate500);
    pdf.text(options.targetUrl.trim(), centerX, 84, { align: 'center', maxWidth: 170 });
  }

  pdf.setFontSize(9);
  pdf.text(analyzedAt, centerX, options.targetUrl?.trim() ? 92 : 84, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(...PDF_COLORS.slate900);
  pdf.text(brandLines.coverBrand, centerX, 118, { align: 'center', maxWidth: 170 });

  if (options.branding?.agencyName) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...PDF_COLORS.slate500);
    pdf.text(`Prepared by ${options.branding.agencyName}`, centerX, 128, { align: 'center' });
  }
}

function addContentPageFooters(pdf: jsPDF, footerText: string, startPage = 2): void {
  const totalPages = pdf.getNumberOfPages();
  if (totalPages < startPage) {
    return;
  }

  for (let page = startPage; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...PDF_COLORS.slate500);
    pdf.text(footerText, PAGE_WIDTH_MM / 2, PAGE_HEIGHT_MM - 8, { align: 'center' });
  }
}

function addCanvasSlicesToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  sliceEnds: number[],
  options?: { addCoverPageFirst?: boolean }
): void {
  let sliceStart = 0;

  sliceEnds.forEach((sliceEnd, index) => {
    if (index > 0 || options?.addCoverPageFirst) {
      pdf.addPage();
    }

    const sliceHeightPx = sliceEnd - sliceStart;
    if (sliceHeightPx <= 0) {
      return;
    }

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;

    const ctx = sliceCanvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sliceCanvas.width, sliceHeightPx);

    ctx.drawImage(
      canvas,
      0,
      sliceStart,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx
    );

    const sliceData = sliceCanvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const sliceHeightMm = (sliceHeightPx * PAGE_WIDTH_MM) / canvas.width;
    pdf.addImage(
      sliceData,
      'JPEG',
      0,
      0,
      PAGE_WIDTH_MM,
      sliceHeightMm,
      undefined,
      'FAST'
    );

    sliceStart = sliceEnd;
  });
}

function applyPrintIconStrokes(clonedDoc: Document): void {
  const iconStyles: Array<{ selector: string; stroke: string }> = [
    { selector: '.icon-success', stroke: '#16a34a' },
    { selector: '.icon-error', stroke: '#dc2626' },
    { selector: '.icon-neutral', stroke: '#4b5563' },
  ];

  iconStyles.forEach(({ selector, stroke }) => {
    clonedDoc.querySelectorAll(`${selector} svg`).forEach(svg => {
      svg.setAttribute('stroke', stroke);
      svg.querySelectorAll('path, line, polyline, circle').forEach(node => {
        node.setAttribute('stroke', stroke);
        node.setAttribute('stroke-width', '3');
        node.setAttribute('fill', 'none');
      });
    });
  });
}

export async function generateCompetitorCompareCanvasPdf(
  element: HTMLElement,
  pdfOptions: CompetitorCompareCanvasPdfOptions = {}
): Promise<Blob> {
  const styleSnapshot = applyCaptureStyles(element);
  const excludedDisplays = hidePdfExcludedElements(element);

  try {
    await waitForLayout();

    const captureHeight = Math.max(element.scrollHeight, element.offsetHeight);
    element.style.minHeight = `${captureHeight}px`;
    await waitForLayout();

    const avoidRanges = computeAvoidRanges(element, CANVAS_SCALE);

    const exportPromise = (async () => {
      const canvas = await html2canvas(element, {
        scale: CANVAS_SCALE,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: CAPTURE_WIDTH_PX,
        height: captureHeight,
        windowWidth: CAPTURE_WIDTH_PX,
        windowHeight: captureHeight,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        onclone: clonedDoc => {
          clonedDoc.documentElement.classList.remove('dark');
          applyPrintIconStrokes(clonedDoc);

          clonedDoc.querySelectorAll<HTMLElement>('.semantic-gaps-table').forEach(node => {
            node.style.whiteSpace = 'normal';
            node.style.overflow = 'visible';
          });

          clonedDoc
            .querySelectorAll<HTMLElement>(
              '.semantic-gap-entity-col, .semantic-gap-entity-title, .semantic-gap-entity-subtitle'
            )
            .forEach(node => {
              node.style.whiteSpace = 'normal';
              node.style.overflow = 'visible';
              node.style.textOverflow = 'clip';
              node.style.wordBreak = 'break-word';
              node.style.lineHeight = '1.35';
              node.style.maxWidth = '320px';
              node.style.minWidth = '220px';
              node.style.width = 'auto';
              node.style.height = 'auto';
              node.style.position = 'static';
              node.style.boxShadow = 'none';
            });

          clonedDoc.querySelectorAll<HTMLElement>('.semantic-gaps-table tr').forEach(node => {
            node.style.height = 'auto';
            node.style.overflow = 'visible';
          });
        },
      });

      const pdf = new jsPDF({
        compress: true,
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      addBrandingCoverPage(pdf, pdfOptions);

      const pageHeightPx = getPageHeightPx(canvas);
      const sliceEnds = computePageSliceEnds(canvas.height, pageHeightPx, avoidRanges);

      addCanvasSlicesToPdf(pdf, canvas, sliceEnds, { addCoverPageFirst: true });

      const brandLines = formatReportBrandingLines(pdfOptions.branding);
      addContentPageFooters(pdf, brandLines.footerLeft);

      return pdf.output('blob');
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('PDF generation timed out after 60 seconds'));
      }, PDF_EXPORT_TIMEOUT_MS);
    });

    return await Promise.race([exportPromise, timeoutPromise]);
  } catch (error) {
    console.error('[competitor-compare-canvas-pdf] generateCompetitorCompareCanvasPdf failed:', error);
    throw error;
  } finally {
    revertCaptureStyles(element, styleSnapshot);
    restorePdfExcludedElements(excludedDisplays);
  }
}
