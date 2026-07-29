import type { GridSize } from './types';

export type GeogridLayout = {
  cellSize: number;
  gap: number;
  rankClass: string;
};

/**
 * Fixed cell footprints so 3×3, 5×5, and 7×7 grids stay compact on desktop
 * without forcing page scroll (~280–320px total width).
 */
const GRID_LAYOUTS: Record<GridSize, GeogridLayout> = {
  3: {
    cellSize: 84,
    gap: 10,
    rankClass: 'text-sm font-bold',
  },
  5: {
    cellSize: 52,
    gap: 6,
    rankClass: 'text-xs font-bold',
  },
  7: {
    cellSize: 38,
    gap: 4,
    rankClass: 'text-[10px] font-bold',
  },
};

export function getGeogridLayout(gridSize: number): GeogridLayout {
  if (gridSize === 3 || gridSize === 5 || gridSize === 7) {
    return GRID_LAYOUTS[gridSize];
  }

  return GRID_LAYOUTS[5];
}

export function getGeogridFootprint(gridSize: number): { width: number; height: number } {
  const { cellSize, gap } = getGeogridLayout(gridSize);
  const span = gridSize * cellSize + (gridSize - 1) * gap;
  return { width: span, height: span };
}
