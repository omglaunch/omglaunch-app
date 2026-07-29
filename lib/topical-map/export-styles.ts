export const TOPICAL_MAP_EXPORT_STYLE_ID = 'topical-map-export-styles';

/** Base canvas size before pixel-ratio scaling (output is multiplied by pixelRatio). */
export const EXPORT_MAX_WIDTH = 3840;
export const EXPORT_MAX_HEIGHT = 2880;
export const EXPORT_PIXEL_RATIO = 2;

const MAP_FLOW_EXPORT_SELECTORS = '.topical-map-flow.is-exporting, .silo-map-flow.is-exporting';

export const TOPICAL_MAP_EXPORT_CSS = `
${MAP_FLOW_EXPORT_SELECTORS} .map-node-title {
  overflow: visible !important;
  display: block !important;
  -webkit-line-clamp: unset !important;
  line-clamp: unset !important;
  -webkit-box-orient: unset !important;
  white-space: normal !important;
  word-break: break-word !important;
  line-height: 1.45 !important;
}
${MAP_FLOW_EXPORT_SELECTORS} .map-node-card--pillar .map-node-title {
  font-size: 14px !important;
}
${MAP_FLOW_EXPORT_SELECTORS} .map-node-card--spoke .map-node-title {
  font-size: 12px !important;
}
${MAP_FLOW_EXPORT_SELECTORS} .map-node-card--spoke span {
  font-size: 10px !important;
}
${MAP_FLOW_EXPORT_SELECTORS} .map-node-hint {
  display: none !important;
}
${MAP_FLOW_EXPORT_SELECTORS} .map-node-keyword {
  overflow: visible !important;
  text-overflow: unset !important;
  white-space: normal !important;
  word-break: break-word !important;
  line-height: 1.45 !important;
  display: block !important;
}
${MAP_FLOW_EXPORT_SELECTORS} .map-node-card--pillar .map-node-keyword {
  font-size: 11px !important;
}
${MAP_FLOW_EXPORT_SELECTORS} .map-node-card {
  overflow: visible !important;
  height: auto !important;
}
${MAP_FLOW_EXPORT_SELECTORS} .map-node-card--pillar {
  width: 320px !important;
}
${MAP_FLOW_EXPORT_SELECTORS} .map-node-card--spoke {
  width: 240px !important;
}
${MAP_FLOW_EXPORT_SELECTORS} .react-flow__node {
  overflow: visible !important;
  height: auto !important;
}
${MAP_FLOW_EXPORT_SELECTORS} .react-flow__node > div {
  overflow: visible !important;
  height: auto !important;
}
${MAP_FLOW_EXPORT_SELECTORS} .react-flow__edge-text {
  font-size: 11px !important;
}
`;

export type ExportCanvasSize = {
  width: number;
  height: number;
  pixelRatio: number;
};

export function computeExportCanvasSize(bounds: {
  width: number;
  height: number;
}): ExportCanvasSize {
  const aspect = bounds.width / Math.max(bounds.height, 1);
  let width: number;
  let height: number;

  if (aspect >= EXPORT_MAX_WIDTH / EXPORT_MAX_HEIGHT) {
    width = EXPORT_MAX_WIDTH;
    height = Math.round(EXPORT_MAX_WIDTH / aspect);
  } else {
    height = EXPORT_MAX_HEIGHT;
    width = Math.round(EXPORT_MAX_HEIGHT * aspect);
  }

  return {
    width: Math.max(width, 1600),
    height: Math.max(height, 1200),
    pixelRatio: EXPORT_PIXEL_RATIO,
  };
}

export function downloadPngBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function ensureTopicalMapExportStyles(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const existing = document.getElementById(TOPICAL_MAP_EXPORT_STYLE_ID);
  if (existing) {
    existing.textContent = TOPICAL_MAP_EXPORT_CSS;
    return;
  }

  const style = document.createElement('style');
  style.id = TOPICAL_MAP_EXPORT_STYLE_ID;
  style.textContent = TOPICAL_MAP_EXPORT_CSS;
  document.head.appendChild(style);
}

export function applyExportPatchesToClone(doc: Document): void {
  doc.querySelectorAll('.map-node-title').forEach(element => {
    const node = element as HTMLElement;
    node.classList.remove('line-clamp-2', 'line-clamp-3');
    node.style.overflow = 'visible';
    node.style.display = 'block';
    node.style.webkitLineClamp = 'unset';
    node.style.setProperty('line-clamp', 'unset');
    node.style.wordBreak = 'break-word';
    node.style.whiteSpace = 'normal';
    node.style.lineHeight = '1.45';
  });

  doc.querySelectorAll('.map-node-hint').forEach(element => {
    (element as HTMLElement).style.display = 'none';
  });

  doc.querySelectorAll('.map-node-keyword').forEach(element => {
    const node = element as HTMLElement;
    node.classList.remove('truncate');
    node.style.overflow = 'visible';
    node.style.textOverflow = 'unset';
    node.style.whiteSpace = 'normal';
    node.style.wordBreak = 'break-word';
    node.style.lineHeight = '1.45';
    node.style.display = 'block';
  });

  doc.querySelectorAll('.map-node-card--pillar .map-node-keyword').forEach(element => {
    (element as HTMLElement).style.fontSize = '11px';
  });

  doc.querySelectorAll('.map-node-card--pillar').forEach(element => {
    (element as HTMLElement).style.width = '320px';
  });

  doc.querySelectorAll('.map-node-card--spoke').forEach(element => {
    (element as HTMLElement).style.width = '240px';
  });

  doc.querySelectorAll('.map-node-card--pillar .map-node-title').forEach(element => {
    (element as HTMLElement).style.fontSize = '14px';
  });

  doc.querySelectorAll('.map-node-card--spoke .map-node-title').forEach(element => {
    (element as HTMLElement).style.fontSize = '12px';
  });

  doc.querySelectorAll('.react-flow__edge-text').forEach(element => {
    (element as HTMLElement).style.fontSize = '11px';
  });

  doc.querySelectorAll('.map-node-card, .react-flow__node, .react-flow__node > div').forEach(element => {
    const node = element as HTMLElement;
    node.style.overflow = 'visible';
    node.style.height = 'auto';
    node.style.minHeight = '0';
  });
}

export function waitForMapLayout(delayMs = 100): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, delayMs);
      });
    });
  });
}

export type ExportViewport = {
  x: number;
  y: number;
  zoom: number;
};

function hideExportChrome(doc: Document): void {
  doc
    .querySelectorAll(
      '.react-flow__controls, .react-flow__minimap, .react-flow__panel, .react-flow__attribution'
    )
    .forEach(element => {
      (element as HTMLElement).style.display = 'none';
    });
}

function resolveReactFlowRoot(flowRoot: HTMLElement): HTMLElement | null {
  if (flowRoot.classList.contains('react-flow')) {
    return flowRoot;
  }

  const nested = flowRoot.querySelector('.react-flow');
  return nested instanceof HTMLElement ? nested : null;
}

function prepareExportCloneLayout(
  flowRoot: HTMLElement,
  doc: Document,
  exportWidth: number,
  exportHeight: number,
  exportViewport: ExportViewport
): void {
  hideExportChrome(doc);

  const reactFlow = resolveReactFlowRoot(flowRoot);
  if (!reactFlow) {
    return;
  }

  flowRoot.style.width = `${exportWidth}px`;
  flowRoot.style.height = `${exportHeight}px`;
  flowRoot.style.overflow = 'visible';
  flowRoot.style.position = 'relative';
  flowRoot.style.background = '#ffffff';

  reactFlow.style.width = `${exportWidth}px`;
  reactFlow.style.height = `${exportHeight}px`;
  reactFlow.style.overflow = 'visible';

  const renderer = reactFlow.querySelector('.react-flow__renderer') as HTMLElement | null;
  if (renderer) {
    renderer.style.width = `${exportWidth}px`;
    renderer.style.height = `${exportHeight}px`;
    renderer.style.overflow = 'visible';
  }

  const viewport = reactFlow.querySelector('.react-flow__viewport') as HTMLElement | null;
  if (viewport) {
    viewport.style.width = `${exportWidth}px`;
    viewport.style.height = `${exportHeight}px`;
    viewport.style.transform = `translate(${exportViewport.x}px, ${exportViewport.y}px) scale(${exportViewport.zoom})`;
    viewport.style.transformOrigin = '0 0';
    viewport.style.overflow = 'visible';
  }
}

export async function captureTopicalMapPng(
  flowRoot: HTMLElement,
  exportWidth: number,
  exportHeight: number,
  exportViewport: ExportViewport,
  pixelRatio: number
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import('html2canvas')).default;

  return html2canvas(flowRoot, {
    backgroundColor: '#ffffff',
    scale: pixelRatio,
    width: exportWidth,
    height: exportHeight,
    windowWidth: exportWidth,
    windowHeight: exportHeight,
    useCORS: true,
    logging: false,
    imageTimeout: 15000,
    onclone: (clonedDoc, clonedElement) => {
      applyExportPatchesToClone(clonedDoc);
      prepareExportCloneLayout(
        clonedElement as HTMLElement,
        clonedDoc,
        exportWidth,
        exportHeight,
        exportViewport
      );
    },
  });
}
