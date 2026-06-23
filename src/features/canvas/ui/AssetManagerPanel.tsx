import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Layers3,
  RefreshCw,
  X,
} from 'lucide-react';

import { UiIconButton, UiPanel } from '@/components/ui';
import { buildCanvasNodeTree, type CanvasNodeTreeItem } from '@/features/canvas/application/buildCanvasNodeTree';
import { canvasEventBus } from '@/features/canvas/application/canvasServices';
import { isComponentDocProjectId } from '@/features/canvas/component-doc';
import { useCanvasStore } from '@/stores/canvasStore';

import { AssetExplorerPanel } from './AssetExplorerPanel';
import { ProjectVersionPanel } from './ProjectVersionPanel';

interface AssetManagerPanelProps {
  projectId: string;
  selectedNodeId: string | null;
  onFocusNode: (nodeId: string) => void;
  onClose: () => void;
}

interface NodeTreeItemProps {
  item: CanvasNodeTreeItem;
  depth: number;
  selectedNodeId: string | null;
  onFocusNode: (nodeId: string) => void;
  defaultExpanded?: boolean;
}

function NodeTreeItem({
  item,
  depth,
  selectedNodeId,
  onFocusNode,
  defaultExpanded = false,
}: NodeTreeItemProps) {
  const hasChildren = item.children.length > 0;
  const [expanded, setExpanded] = useState(defaultExpanded || item.isGroup);
  const isSelected = selectedNodeId === item.nodeId;

  return (
    <div>
      <button
        type="button"
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-bg-dark/70 ${
          isSelected ? 'bg-accent/15 text-accent' : 'text-text-dark'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          onFocusNode(item.nodeId);
          if (hasChildren) {
            setExpanded(true);
          }
        }}
      >
        {hasChildren ? (
          <span
            className="inline-flex h-3 w-3 shrink-0 items-center justify-center"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
          >
            {expanded ? <ChevronDown className="h-3 w-3 text-text-muted" /> : <ChevronRight className="h-3 w-3 text-text-muted" />}
          </span>
        ) : (
          <span className="inline-block h-3 w-3 shrink-0" />
        )}
        <Layers3 className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </button>
      {expanded && item.children.map((child) => (
        <NodeTreeItem
          key={child.id}
          item={child}
          depth={depth + 1}
          selectedNodeId={selectedNodeId}
          onFocusNode={onFocusNode}
        />
      ))}
    </div>
  );
}

export const AssetManagerPanel = memo(({
  projectId,
  selectedNodeId,
  onFocusNode,
  onClose,
}: AssetManagerPanelProps) => {
  const nodes = useCanvasStore((state) => state.nodes);
  const [activeTab, setActiveTab] = useState<'assets' | 'nodes' | 'version'>('assets');
  const [explorerKey, setExplorerKey] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const readOnly = isComponentDocProjectId(projectId);
  const skipTabRefreshRef = useRef(true);

  const handleRefresh = useCallback(() => {
    setExplorerKey((value) => value + 1);
    setRefreshSignal((value) => value + 1);
  }, []);

  useEffect(() => {
    return canvasEventBus.subscribe('asset-explorer/reveal-asset', () => {
      setActiveTab('assets');
    });
  }, []);

  useEffect(() => {
    return canvasEventBus.subscribe('asset-manager/refresh', () => {
      handleRefresh();
    });
  }, [handleRefresh]);

  useEffect(() => {
    if (skipTabRefreshRef.current) {
      skipTabRefreshRef.current = false;
      return;
    }
    if (activeTab === 'assets') {
      setExplorerKey((value) => value + 1);
    } else if (activeTab === 'version') {
      setRefreshSignal((value) => value + 1);
    }
  }, [activeTab]);

  const nodeTree = buildCanvasNodeTree(nodes);

  const selectTab = useCallback((tab: 'assets' | 'nodes' | 'version') => {
    setActiveTab(tab);
  }, []);

  return (
    <div className="pointer-events-none absolute left-4 top-[4.75rem] z-20 w-[min(22rem,calc(100vw-2rem))]">
      <UiPanel className="pointer-events-auto flex max-h-[min(36rem,calc(100vh-8rem))] flex-col overflow-hidden rounded-xl shadow-xl">
        <div className="flex items-center justify-between border-b border-border-dark px-3 py-2">
          <div>
            <div className="text-sm font-medium text-text-dark">资产管理</div>
            <div className="text-[11px] text-text-muted">
              {readOnly ? '演示项目只读' : '⌘/Ctrl+C X V · Delete · 拖拽移动'}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <UiIconButton
              className="h-7 w-7"
              title="刷新"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </UiIconButton>
            <UiIconButton className="h-7 w-7" title="关闭" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </UiIconButton>
          </div>
        </div>

        <div className="flex border-b border-border-dark px-2 pt-1">
          <button
            type="button"
            className={`rounded-t-md px-3 py-1.5 text-xs ${
              activeTab === 'assets'
                ? 'bg-bg-dark/50 font-medium text-text-dark'
                : 'text-text-muted hover:text-text-dark'
            }`}
            onClick={() => selectTab('assets')}
          >
            资产目录
          </button>
          <button
            type="button"
            className={`rounded-t-md px-3 py-1.5 text-xs ${
              activeTab === 'nodes'
                ? 'bg-bg-dark/50 font-medium text-text-dark'
                : 'text-text-muted hover:text-text-dark'
            }`}
            onClick={() => selectTab('nodes')}
          >
            画布节点
          </button>
          <button
            type="button"
            className={`rounded-t-md px-3 py-1.5 text-xs ${
              activeTab === 'version'
                ? 'bg-bg-dark/50 font-medium text-text-dark'
                : 'text-text-muted hover:text-text-dark'
            }`}
            onClick={() => selectTab('version')}
          >
            版本
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
          <section className={activeTab === 'assets' ? '' : 'hidden'}>
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
              assets/
            </div>
            <AssetExplorerPanel
              key={explorerKey}
              projectId={projectId}
              readOnly={readOnly}
            />
          </section>

          <section className={activeTab === 'nodes' ? '' : 'hidden'}>
            {nodeTree.length > 0 ? (
              nodeTree.map((item) => (
                <NodeTreeItem
                  key={item.id}
                  item={item}
                  depth={0}
                  selectedNodeId={selectedNodeId}
                  onFocusNode={onFocusNode}
                  defaultExpanded
                />
              ))
            ) : (
              <div className="px-2 py-2 text-xs text-text-muted">暂无节点</div>
            )}
          </section>

          <div className={activeTab === 'version' ? '' : 'hidden'}>
            <ProjectVersionPanel
              projectId={projectId}
              enabled={activeTab === 'version'}
              readOnly={readOnly}
              refreshSignal={refreshSignal}
            />
          </div>
        </div>
      </UiPanel>
    </div>
  );
});

AssetManagerPanel.displayName = 'AssetManagerPanel';
