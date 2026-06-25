import { memo, useMemo, useState } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

import {
  normalizeGitDiffValues,
  type GitDiffCompareMethod,
} from './gitDiffUtils';

const DIFF_METHOD_MAP: Record<GitDiffCompareMethod, DiffMethod> = {
  json: DiffMethod.JSON,
  yaml: DiffMethod.YAML,
  lines: DiffMethod.LINES,
};

const DIFF_VIEWER_STYLES = {
  variables: {
    dark: {
      diffViewerBackground: '#1a1d24',
      gutterBackground: '#14171c',
      gutterBackgroundDark: '#101218',
      diffViewerTitleBackground: '#1a1d24',
      diffViewerTitleBorderColor: 'rgba(255,255,255,0.08)',
    },
  },
  contentText: {
    fontSize: '12px',
    lineHeight: '1.5',
  },
  line: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
};

type DiffViewLayout = 'split' | 'unified';

function DiffViewLayoutToggle({
  value,
  onChange,
}: {
  value: DiffViewLayout;
  onChange: (next: DiffViewLayout) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5">
      <button
        type="button"
        className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
          value === 'split'
            ? 'bg-bg-dark/80 font-medium text-text-dark'
            : 'text-text-muted hover:text-text-dark'
        }`}
        onClick={() => onChange('split')}
      >
        分栏
      </button>
      <button
        type="button"
        className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
          value === 'unified'
            ? 'bg-bg-dark/80 font-medium text-text-dark'
            : 'text-text-muted hover:text-text-dark'
        }`}
        onClick={() => onChange('unified')}
      >
        统一
      </button>
    </div>
  );
}

interface GitTextDiffViewerProps {
  path: string;
  oldValue: string;
  newValue: string;
  leftTitle: string;
  rightTitle: string;
}

export const GitTextDiffViewer = memo(({
  path,
  oldValue,
  newValue,
  leftTitle,
  rightTitle,
}: GitTextDiffViewerProps) => {
  const [layout, setLayout] = useState<DiffViewLayout>('split');
  const normalized = useMemo(
    () => normalizeGitDiffValues(path, oldValue, newValue),
    [newValue, oldValue, path],
  );
  const compareMethod = DIFF_METHOD_MAP[normalized.compareMethod];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 justify-end">
        <DiffViewLayoutToggle value={layout} onChange={setLayout} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border-dark bg-bg-dark/20 [&_table]:w-full">
        <ReactDiffViewer
          oldValue={normalized.oldValue}
          newValue={normalized.newValue}
          compareMethod={compareMethod}
          splitView={layout === 'split'}
          useDarkTheme
          showDiffOnly
          extraLinesSurroundingDiff={3}
          disableWordDiff={false}
          leftTitle={leftTitle}
          rightTitle={rightTitle}
          styles={DIFF_VIEWER_STYLES}
        />
      </div>
    </div>
  );
});

GitTextDiffViewer.displayName = 'GitTextDiffViewer';
