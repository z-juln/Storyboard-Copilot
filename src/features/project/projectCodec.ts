import type { Viewport } from '@xyflow/react';

import type { CanvasHistoryState } from '@/stores/canvasStore';

import { createEmptyAssetManifest, stripLegacyPreviewFieldsFromNodes } from './asset';
import type { Project, ProjectSnapshot } from './types';

export const MAX_PERSISTED_HISTORY_STEPS = 12;
export const MAX_HISTORY_RESTORE_JSON_CHARS = 1_500_000;

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

function trimHistoryForPersistence(history: CanvasHistoryState): CanvasHistoryState {
  return {
    past: history.past.slice(-MAX_PERSISTED_HISTORY_STEPS),
    future: history.future.slice(-MAX_PERSISTED_HISTORY_STEPS),
  };
}

export function snapshotToProject(snapshot: ProjectSnapshot): Project {
  const historyJsonLength = JSON.stringify(snapshot.history ?? {}).length;
  if (historyJsonLength > MAX_HISTORY_RESTORE_JSON_CHARS) {
    console.warn(
      `Skip restoring oversized history payload (${historyJsonLength} chars) for project ${snapshot.id}`
    );
    return {
      ...snapshot,
      nodeCount: snapshot.nodes.length,
      nodes: stripLegacyPreviewFieldsFromNodes(snapshot.nodes),
      viewport: snapshot.viewport ?? DEFAULT_VIEWPORT,
      history: { past: [], future: [] },
      assetManifest: snapshot.assetManifest ?? createEmptyAssetManifest(),
    };
  }

  return {
    ...snapshot,
    nodeCount: snapshot.nodes.length,
    nodes: stripLegacyPreviewFieldsFromNodes(snapshot.nodes),
    viewport: snapshot.viewport ?? DEFAULT_VIEWPORT,
    history: snapshot.history ?? { past: [], future: [] },
    assetManifest: snapshot.assetManifest ?? createEmptyAssetManifest(),
  };
}

export function projectToSnapshot(project: Project): ProjectSnapshot {
  const history = trimHistoryForPersistence(project.history ?? { past: [], future: [] });

  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    nodeCount: project.nodes.length,
    viewport: project.viewport ?? DEFAULT_VIEWPORT,
    nodes: project.nodes,
    edges: project.edges,
    history,
    assetManifest: project.assetManifest ?? createEmptyAssetManifest(),
  };
}

export function createEmptyHistory(): CanvasHistoryState {
  return {
    past: [],
    future: [],
  };
}

export { DEFAULT_VIEWPORT };
