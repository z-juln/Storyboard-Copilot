export const TEXT_NODE_DEFAULT_WIDTH = 600;
export const TEXT_NODE_DEFAULT_HEIGHT = 220;
export const TEXT_NODE_MIN_WIDTH = 200;
export const TEXT_NODE_MIN_HEIGHT = 140;
export const TEXT_NODE_MAX_WIDTH = 900;
export const TEXT_NODE_MAX_HEIGHT = 900;
export const TEXT_NODE_INITIAL_MAX_HEIGHT = 420;
export const TEXT_NODE_LINE_HEIGHT = 24;
export const TEXT_NODE_CONTENT_PADDING = 48;
export const TEXT_NODE_INITIAL_MIN_VISIBLE_LINES = 6;
export const TEXT_NODE_INITIAL_MAX_VISIBLE_LINES = 14;

export function resolveTextNodeInitialSize(content: string): { width: number; height: number } {
  const lineCount = content.split('\n').length;
  const visibleLines = Math.min(
    Math.max(lineCount, TEXT_NODE_INITIAL_MIN_VISIBLE_LINES),
    TEXT_NODE_INITIAL_MAX_VISIBLE_LINES
  );
  const height = Math.min(
    TEXT_NODE_INITIAL_MAX_HEIGHT,
    Math.max(
      TEXT_NODE_DEFAULT_HEIGHT,
      visibleLines * TEXT_NODE_LINE_HEIGHT + TEXT_NODE_CONTENT_PADDING
    )
  );

  return {
    width: TEXT_NODE_DEFAULT_WIDTH,
    height,
  };
}

export interface NodeLayoutSize {
  width: number;
  height: number;
}
