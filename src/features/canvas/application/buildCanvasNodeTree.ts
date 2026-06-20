import type { CanvasNode } from '@/stores/canvasStore';
import { CANVAS_NODE_TYPES } from '@/features/canvas/domain/canvasNodes';
import { resolveNodeDisplayName } from '@/features/canvas/domain/nodeDisplay';

export interface CanvasNodeTreeItem {
  id: string;
  label: string;
  nodeId: string;
  isGroup: boolean;
  children: CanvasNodeTreeItem[];
}

export function buildCanvasNodeTree(nodes: CanvasNode[]): CanvasNodeTreeItem[] {
  const nodesByParent = new Map<string | undefined, CanvasNode[]>();

  for (const node of nodes) {
    const parentId = typeof node.parentId === 'string' ? node.parentId : undefined;
    const siblings = nodesByParent.get(parentId) ?? [];
    siblings.push(node);
    nodesByParent.set(parentId, siblings);
  }

  const buildLevel = (parentId: string | undefined): CanvasNodeTreeItem[] => {
    const siblings = nodesByParent.get(parentId) ?? [];
    return siblings
      .slice()
      .sort((left, right) =>
        resolveNodeDisplayName(left.type, left.data).localeCompare(
          resolveNodeDisplayName(right.type, right.data),
          'zh-CN'
        )
      )
      .map((node) => {
        const isGroup = node.type === CANVAS_NODE_TYPES.group;
        return {
          id: node.id,
          label: resolveNodeDisplayName(node.type, node.data),
          nodeId: node.id,
          isGroup,
          children: isGroup ? buildLevel(node.id) : [],
        };
      });
  };

  return buildLevel(undefined);
}
