import {
  memo,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Loader2, Play } from 'lucide-react';

import {
  collectInputTexts,
  mergePromptWithInputTexts,
} from '@/features/canvas/application/graphTextResolver';
import { resolveErrorContent, showErrorDialog } from '@/features/canvas/application/errorDialog';
import {
  prepareNodeImageForCanvas,
  toPreparedNodeImageFields,
} from '@/features/canvas/application/imageData';
import { runExternalTech } from '@/features/canvas/application/runExternalTech';
import {
  CANVAS_NODE_TYPES,
  EXPORT_RESULT_NODE_DEFAULT_WIDTH,
  EXPORT_RESULT_NODE_LAYOUT_HEIGHT,
  type ExternalTechNodeData,
} from '@/features/canvas/domain/canvasNodes';
import { resolveNodeDisplayName } from '@/features/canvas/domain/nodeDisplay';
import {
  getExternalTechProvider,
  listExternalTechProviders,
} from '@/features/canvas/external-tech/registry';
import { openLocalZImageInstallDialog } from '@/features/local-zimage/localZImageInstallEvents';
import {
  DEFAULT_ZIMAGE_SIZE,
  estimateZImageDurationMs,
  normalizeZImageSize,
  ZIMAGE_SIZE_OPTIONS,
} from '@/features/local-zimage/zimageOptions';
import { ZIMAGE_LOCAL_PROVIDER_ID } from '@/features/canvas/external-tech/providers/zimageLocal';
import { rustApiClient } from '@/infrastructure/rustApiClient';
import { NodeHeader, NODE_HEADER_FLOATING_POSITION_CLASS } from '@/features/canvas/ui/NodeHeader';
import { NodeResizeHandle } from '@/features/canvas/ui/NodeResizeHandle';
import {
  NODE_CONTROL_CHIP_CLASS,
  NODE_CONTROL_ICON_CLASS,
  NODE_CONTROL_PRIMARY_BUTTON_CLASS,
} from '@/features/canvas/ui/nodeControlStyles';
import { UiButton } from '@/components/ui';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';

const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 520;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 360;

type ExternalTechNodeProps = NodeProps & {
  id: string;
  data: ExternalTechNodeData;
  selected?: boolean;
};

function buildResultNodeTitle(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return '结果图片';
  }
  return compact.length > 24 ? `${compact.slice(0, 24)}…` : compact;
}

export const ExternalTechNode = memo(({
  id,
  data,
  selected,
  width,
  height,
}: ExternalTechNodeProps) => {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const addNode = useCanvasStore((state) => state.addNode);
  const addEdge = useCanvasStore((state) => state.addEdge);
  const findNodePosition = useCanvasStore((state) => state.findNodePosition);
  const currentProjectId = useProjectStore((state) => state.currentProjectId);

  const [promptDraft, setPromptDraft] = useState(typeof data.prompt === 'string' ? data.prompt : '');

  const providerId = typeof data.providerId === 'string' ? data.providerId : '';
  const provider = useMemo(
    () => getExternalTechProvider(providerId) ?? listExternalTechProviders()[0] ?? null,
    [providerId]
  );
  const providers = useMemo(() => listExternalTechProviders(), []);
  const isRunning = data.isRunning === true;
  const isLocalZImage = provider?.id === ZIMAGE_LOCAL_PROVIDER_ID;
  const imageSize = normalizeZImageSize(data.imageSize ?? DEFAULT_ZIMAGE_SIZE);
  const nodeWidth = typeof width === 'number' && width > 0 ? width : DEFAULT_WIDTH;
  const nodeHeight = typeof height === 'number' && height > 0 ? height : DEFAULT_HEIGHT;

  const upstreamTexts = useMemo(
    () => collectInputTexts(id, nodes, edges),
    [edges, id, nodes]
  );

  const handleProviderChange = useCallback((nextProviderId: string) => {
    updateNodeData(id, { providerId: nextProviderId });
  }, [id, updateNodeData]);

  const commitPromptDraft = useCallback((nextValue: string) => {
    setPromptDraft(nextValue);
    updateNodeData(id, { prompt: nextValue });
  }, [id, updateNodeData]);

  const handleGenerate = useCallback(async () => {
    if (!provider) {
      void showErrorDialog('未找到外部科技场景配置', '错误');
      return;
    }

    const mergedPrompt = mergePromptWithInputTexts(promptDraft, upstreamTexts);
    if (!mergedPrompt.trim()) {
      void showErrorDialog('请输入提示词或连接文本节点', '错误');
      return;
    }

    if (provider.runner === 'local-zimage' && !currentProjectId) {
      void showErrorDialog('请先打开或创建项目后再生成', '错误');
      return;
    }

    if (provider.runner === 'local-zimage') {
      try {
        const localStatus = await rustApiClient.getLocalZImageStatus();
        if (localStatus.needs_setup) {
          openLocalZImageInstallDialog({ focusCurrentStep: true });
          void showErrorDialog(
            '本地 Z-Image 尚未就绪。请先在安装向导中逐步完成安装与启动（每一步需确认）。',
            '需要安装'
          );
          return;
        }
      } catch (statusError) {
        void showErrorDialog(
          statusError instanceof Error ? statusError.message : '无法读取本地 Z-Image 状态',
          '错误'
        );
        return;
      }
    }

    const generationDurationMs = isLocalZImage
      ? estimateZImageDurationMs(imageSize)
      : (data.generationDurationMs ?? 300000);
    const generationStartedAt = Date.now();
    const resultNodeTitle = buildResultNodeTitle(mergedPrompt);

    updateNodeData(id, {
      isRunning: true,
      generationStartedAt,
    });

    const newNodePosition = findNodePosition(
      id,
      EXPORT_RESULT_NODE_DEFAULT_WIDTH,
      EXPORT_RESULT_NODE_LAYOUT_HEIGHT
    );
    const newNodeId = addNode(
      CANVAS_NODE_TYPES.exportImage,
      newNodePosition,
      {
        isGenerating: true,
        generationStartedAt,
        generationDurationMs,
        resultKind: 'generic',
        displayName: resultNodeTitle,
      }
    );
    addEdge(id, newNodeId);

    try {
      const result = await runExternalTech({
        providerId: provider.id,
        prompt: mergedPrompt,
        projectId: currentProjectId,
        inputs: {
          prompt: mergedPrompt,
          ...(isLocalZImage ? { size: String(imageSize) } : {}),
        },
      });

      const imageOutput = result.outputs.image?.trim();
      if (!imageOutput) {
        throw new Error('外部科技未返回图片结果');
      }

      const prepared = await prepareNodeImageForCanvas(
        imageOutput.startsWith('/') ? `file://${imageOutput}` : imageOutput
      );
      updateNodeData(newNodeId, {
        ...toPreparedNodeImageFields(prepared),
        isGenerating: false,
        generationStartedAt: null,
        generationError: null,
        generationErrorDetails: null,
      });
    } catch (error) {
      const resolvedError = resolveErrorContent(error, '外部科技执行失败');
      updateNodeData(newNodeId, {
        isGenerating: false,
        generationStartedAt: null,
        generationError: resolvedError.message,
        generationErrorDetails: resolvedError.details,
      });
      void showErrorDialog(resolvedError.message, '错误', resolvedError.details);
    } finally {
      updateNodeData(id, {
        isRunning: false,
        generationStartedAt: null,
        prompt: promptDraft,
      });
    }
  }, [
    addEdge,
    addNode,
    data.generationDurationMs,
    currentProjectId,
    findNodePosition,
    id,
    imageSize,
    isLocalZImage,
    promptDraft,
    provider,
    updateNodeData,
    upstreamTexts,
  ]);

  return (
    <div
      className="group/node relative flex flex-col rounded-xl border border-border-dark bg-surface-dark shadow-lg"
      style={{ width: nodeWidth, height: nodeHeight }}
    >
      <NodeHeader
        className={NODE_HEADER_FLOATING_POSITION_CLASS}
        titleText={resolveNodeDisplayName(CANVAS_NODE_TYPES.externalTech, data)}
        editable
        onTitleChange={(nextTitle) => updateNodeData(id, { displayName: nextTitle })}
      />

      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-accent !bg-bg-dark"
      />
      <Handle
        id="source"
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-accent !bg-bg-dark"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 pt-10">
        <div className="flex items-center gap-2">
          <label className="shrink-0 text-[11px] text-text-muted">场景</label>
          <select
            value={provider?.id ?? ''}
            disabled={isRunning}
            onChange={(event) => handleProviderChange(event.target.value)}
            onMouseDown={(event) => event.stopPropagation()}
            className={`${NODE_CONTROL_CHIP_CLASS} nodrag nowheel min-w-0 flex-1 border border-border-dark bg-bg-dark text-text-dark outline-none`}
          >
            {providers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {isLocalZImage ? (
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[11px] text-text-muted">尺寸</label>
            <select
              value={String(imageSize)}
              disabled={isRunning}
              onChange={(event) => {
                const nextSize = normalizeZImageSize(Number(event.target.value));
                updateNodeData(id, {
                  imageSize: nextSize,
                  generationDurationMs: estimateZImageDurationMs(nextSize),
                });
              }}
              onMouseDown={(event) => event.stopPropagation()}
              className={`${NODE_CONTROL_CHIP_CLASS} nodrag nowheel min-w-0 flex-1 border border-border-dark bg-bg-dark text-text-dark outline-none`}
            >
              {ZIMAGE_SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {provider?.embedUrl ? (
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border-dark bg-bg-dark">
            <iframe
              title={provider.label}
              src={provider.embedUrl}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
            {isRunning ? (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-dark/70 text-xs text-text-muted">
                正在本地生成…
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="relative min-h-[72px] shrink-0 rounded-lg border border-border-dark bg-bg-dark/60 p-2">
          <textarea
            value={promptDraft}
            disabled={isRunning}
            onChange={(event) => setPromptDraft(event.target.value)}
            onBlur={() => commitPromptDraft(promptDraft)}
            onMouseDown={(event) => event.stopPropagation()}
            placeholder={provider?.inputs.find((port) => port.id === 'prompt')?.label ?? '输入提示词'}
            className="ui-scrollbar nodrag nowheel h-full min-h-[56px] w-full resize-none border-none bg-transparent text-sm leading-6 text-text-dark outline-none placeholder:text-text-muted/80"
          />
          {upstreamTexts.length > 0 ? (
            <div className="mt-1 text-[10px] text-text-muted">
              已连接 {upstreamTexts.length} 个文本输入
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border-dark px-3 py-2">
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-[10px] text-accent hover:underline"
          onClick={() => openLocalZImageInstallDialog({ focusCurrentStep: true })}
        >
          打开本地 Z-Image 安装向导
        </button>
        <UiButton
          type="button"
          size="sm"
          variant="primary"
          disabled={isRunning}
          className={NODE_CONTROL_PRIMARY_BUTTON_CLASS}
          onClick={() => {
            void handleGenerate();
          }}
        >
          {isRunning ? (
            <Loader2 className={`${NODE_CONTROL_ICON_CLASS} animate-spin`} />
          ) : (
            <Play className={NODE_CONTROL_ICON_CLASS} />
          )}
          生成
        </UiButton>
      </div>

      {selected ? (
        <NodeResizeHandle
          minWidth={MIN_WIDTH}
          minHeight={MIN_HEIGHT}
        />
      ) : null}
    </div>
  );
});

ExternalTechNode.displayName = 'ExternalTechNode';
