import { MarkerType, type Edge, type Node } from 'reactflow';
import type { SiloNodeDto } from '@/lib/silo-builder/types';
import {
  SILO_MAP_BRAND_BLUE,
  SILO_MAP_LATERAL_SLATE,
  normalizeSiloNodeTitle,
  truncateSiloMapLabel,
} from '@/lib/silo-builder/map-graph-utils';

const CANVAS_CENTER_X = 600;
const CANVAS_CENTER_Y = 400;
const SPOKE_RADIUS = 460;
const PILLAR_WIDTH = 220;
const PILLAR_HEIGHT = 72;
const SPOKE_WIDTH = 170;
const SPOKE_HEIGHT = 78;

export function buildSiloFlowGraph(nodes: SiloNodeDto[]): {
  nodes: Node[];
  edges: Edge[];
} {
  const pillar = nodes.find(node => node.type === 'PILLAR');
  const spokes = nodes.filter(node => node.type === 'SPOKE');

  if (!pillar) {
    return { nodes: [], edges: [] };
  }

  const flowNodes: Node[] = [
    {
      id: pillar.id,
      type: 'pillar',
      position: {
        x: CANVAS_CENTER_X - PILLAR_WIDTH / 2,
        y: CANVAS_CENTER_Y - PILLAR_HEIGHT / 2,
      },
      data: { node: pillar },
      draggable: false,
    },
  ];

  const edges: Edge[] = [];
  const titleToNodeId = new Map<string, string>();

  spokes.forEach((spoke, index) => {
    const angle = (2 * Math.PI * index) / spokes.length - Math.PI / 2;
    const x = CANVAS_CENTER_X + SPOKE_RADIUS * Math.cos(angle) - SPOKE_WIDTH / 2;
    const y = CANVAS_CENTER_Y + SPOKE_RADIUS * Math.sin(angle) - SPOKE_HEIGHT / 2;

    titleToNodeId.set(normalizeSiloNodeTitle(spoke.title), spoke.id);

    flowNodes.push({
      id: spoke.id,
      type: 'spoke',
      position: { x, y },
      data: { node: spoke },
      draggable: false,
    });

    edges.push({
      id: `pillar-link-${spoke.id}`,
      source: spoke.id,
      target: pillar.id,
      type: 'default',
      label: spoke.anchorTextToPillar
        ? truncateSiloMapLabel(spoke.anchorTextToPillar)
        : undefined,
      style: { stroke: SILO_MAP_BRAND_BLUE, strokeWidth: 2 },
      labelStyle: { fill: '#1e40af', fontSize: 9, fontWeight: 500 },
      labelBgStyle: { fill: '#eff6ff', fillOpacity: 0.96 },
      labelBgPadding: [4, 3],
      labelBgBorderRadius: 3,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: SILO_MAP_BRAND_BLUE,
        width: 14,
        height: 14,
      },
    });
  });

  spokes.forEach(spoke => {
    spoke.lateralLinks.forEach((link, linkIndex) => {
      const targetId = titleToNodeId.get(normalizeSiloNodeTitle(link.spokeTitle));
      if (!targetId || targetId === spoke.id) {
        return;
      }

      edges.push({
        id: `lateral-${spoke.id}-${targetId}-${linkIndex}`,
        source: spoke.id,
        target: targetId,
        type: 'smoothstep',
        label: truncateSiloMapLabel(link.suggestedLateralAnchorText, 18),
        style: {
          stroke: SILO_MAP_LATERAL_SLATE,
          strokeWidth: 1.25,
          strokeDasharray: '5 4',
        },
        labelStyle: { fill: '#64748b', fontSize: 8 },
        labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.96 },
        labelBgPadding: [3, 2],
        labelBgBorderRadius: 3,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: SILO_MAP_LATERAL_SLATE,
          width: 12,
          height: 12,
        },
      });
    });
  });

  return { nodes: flowNodes, edges };
}
