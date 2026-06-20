const pendingByNodeId = new Map<string, File>();
const handlersByNodeId = new Map<string, Set<(file: File) => void>>();

export function publishUploadNodePasteImage(nodeId: string, file: File): void {
  const handlers = handlersByNodeId.get(nodeId);
  if (handlers && handlers.size > 0) {
    handlers.forEach((handler) => {
      handler(file);
    });
    return;
  }

  pendingByNodeId.set(nodeId, file);
}

export function subscribeUploadNodePasteImage(
  nodeId: string,
  handler: (file: File) => void
): () => void {
  const handlers = handlersByNodeId.get(nodeId) ?? new Set<(file: File) => void>();
  handlers.add(handler);
  handlersByNodeId.set(nodeId, handlers);

  const pending = pendingByNodeId.get(nodeId);
  if (pending) {
    pendingByNodeId.delete(nodeId);
    handler(pending);
  }

  return () => {
    const currentHandlers = handlersByNodeId.get(nodeId);
    if (!currentHandlers) {
      return;
    }
    currentHandlers.delete(handler);
    if (currentHandlers.size === 0) {
      handlersByNodeId.delete(nodeId);
    }
  };
}
