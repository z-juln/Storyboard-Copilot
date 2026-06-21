import {
  isTextAnnotationNode,
  isTextNode,
  type CanvasEdge,
  type CanvasNode,
} from '../domain/canvasNodes';

export function collectInputTexts(
  nodeId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): string[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const sourceNodeIds = edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => edge.source);

  const texts: string[] = [];
  for (const sourceId of sourceNodeIds) {
    const node = nodeById.get(sourceId);
    if (!node) {
      continue;
    }
    if (isTextNode(node)) {
      const content = typeof node.data.textContent === 'string' ? node.data.textContent.trim() : '';
      if (content) {
        texts.push(content);
      }
      continue;
    }
    if (isTextAnnotationNode(node)) {
      const content = typeof node.data.content === 'string' ? node.data.content.trim() : '';
      if (content) {
        texts.push(content);
      }
    }
  }

  return texts;
}

export function mergePromptWithInputTexts(prompt: string, upstreamTexts: string[]): string {
  return [...upstreamTexts, prompt.trim()].filter((item) => item.length > 0).join('\n\n');
}
