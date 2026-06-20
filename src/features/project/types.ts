import type { Viewport } from '@xyflow/react';

import type { CanvasEdge, CanvasHistoryState, CanvasNode } from '@/stores/canvasStore';

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
}

export interface Project extends ProjectSummary {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Viewport;
  history: CanvasHistoryState;
}

/** 磁盘 / 仓库中的 project.json 形态 */
export interface ProjectSnapshot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  viewport: Viewport;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  history: CanvasHistoryState;
}
