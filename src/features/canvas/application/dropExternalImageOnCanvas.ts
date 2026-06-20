import type { XYPosition } from '@xyflow/react';

import { publishUploadNodePasteImage } from '@/features/canvas/application/uploadNodePasteBridge';
import { CANVAS_NODE_TYPES, type CanvasNodeType } from '@/features/canvas/domain/canvasNodes';

export interface DropExternalImageOnCanvasInput {
  file: File;
  position: XYPosition;
  addNode: (
    type: CanvasNodeType,
    position: XYPosition,
    data?: Record<string, unknown>
  ) => string;
  setSelectedNode: (nodeId: string) => void;
}

export function dropExternalImageOnCanvas(input: DropExternalImageOnCanvasInput): string {
  const nodeId = input.addNode(CANVAS_NODE_TYPES.upload, input.position, {});
  input.setSelectedNode(nodeId);
  publishUploadNodePasteImage(nodeId, input.file);
  return nodeId;
}
