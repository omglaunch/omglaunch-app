/**
 * Portal z-index manager — Context-Aware stacking for sticky headers / modals.
 */

export const Z_INDEX = {
  stickyHeader: 20,
  stickyColumn: 10,
  dropdownPortal: 80,
  stagingModal: 50,
  actionBar: 60,
  desktopOverlay: 70,
  toast: 100,
} as const;

let portalStack = 0;

export function acquirePortalZIndex(base = Z_INDEX.dropdownPortal): number {
  portalStack += 1;
  return base + portalStack;
}

export function releasePortalZIndex() {
  portalStack = Math.max(0, portalStack - 1);
}
