import {
  memo,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Loader2, Play, AlertTriangle, CheckCircle2 } from 'lucide-react';

import {
  collectInputTexts,
  mergePromptWithInputTexts,
} from '@/features/canvas/application/graphTextResolver';
import { resolveErrorContent, showErrorDialog } from '@/features/canvas/application/errorDialog';
import {
  prepareNodeImageForCanvas,
  toPreparedNodeImageFields,
} from '@/features/canvas/application/imageData';
import { CURRENT_RUNTIME_SESSION_ID } from '@/features/canvas/application/generationErrorReport';
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
import { isLocalZImageFullyReady } from '@/features/local-zimage/LocalZImageModelLoadBanner';
import { useLocalZImageStatus } from '@/features/local-zimage/useLocalZImageStatus';
import { navigateToProjectHomeTab } from '@/features/project/projectHomeNavigation';
import {
  DEFAULT_ZIMAGE_SIZE,
  estimateZImageDurationMs,
  normalizeZImageSize,
  ZIMAGE_SIZE_OPTIONS,
} from '@/features/local-zimage/zimageOptions';
import { ZIMAGE_LOCAL_PROVIDER_ID } from '@/features/canvas/external-tech/providers/zimageLocal';
import { rustApiClient } from '@/infrastructure/rustApiClient';
import { NodeHeader, NODE_HEADER_FLOATING_POSITION_CLASS } from '@/features/canvas/ui/NodeHeader';
import { NodeEditableSelect } from '@/features/canvas/ui/NodeEditableSelect';
import { NodeEditableTextarea } from '@/features/canvas/ui/NodeEditableTextarea';
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
  const setSelectedNode = useCanvasStore((state) => state.setSelectedNode);
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
  const localZImageStatus = useLocalZImageStatus(isLocalZImage);
  const isZImageReady = isLocalZImageFullyReady(localZImageStatus);
  const isZImageModelLoading = Boolean(localZImageStatus?.model_loading);
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
        const localStatus = localZImageStatus ?? await rustApiClient.getLocalZImageStatus();
        if (!isLocalZImageFullyReady(localStatus)) {
          navigateToProjectHomeTab('plugins');
          void showErrorDialog(
            '本地 Z-Image 尚未就绪。请先在项目管理 → 插件列表中安装并启动服务后再生成。',
            '服务未就绪'
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

    if (isLocalZImage) {
      updateNodeData(id, { isRunning: true, generationStartedAt });
      try {
        const { job_id: jobId } = await rustApiClient.submitLocalZImageJob({
          prompt: mergedPrompt,
          size: imageSize,
          projectId: currentProjectId,
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
            generationJobId: jobId,
            generationProviderId: ZIMAGE_LOCAL_PROVIDER_ID,
            generationClientSessionId: CURRENT_RUNTIME_SESSION_ID,
          }
        );
        addEdge(id, newNodeId);
        updateNodeData(id, {
          prompt: promptDraft,
          isRunning: false,
          generationStartedAt: null,
        });
      } catch (error) {
        const resolvedError = resolveErrorContent(error, '提交 Z-Image 生成任务失败');
        void showErrorDialog(resolvedError.message, '错误', resolvedError.details);
        updateNodeData(id, {
          isRunning: false,
          generationStartedAt: null,
        });
      }
      return;
    }

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
    localZImageStatus,
    promptDraft,
    provider,
    updateNodeData,
    upstreamTexts,
  ]);

  return (
    <div
      className="group/node relative flex flex-col rounded-xl border border-border-dark bg-surface-dark shadow-lg"
      style={{ width: nodeWidth, height: nodeHeight }}
      onClick={() => setSelectedNode(id)}
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
          <NodeEditableSelect
            selected={selected}
            value={provider?.id ?? ''}
            disabled={isRunning}
            onEnterEditing={() => setSelectedNode(id)}
            onValueChange={handleProviderChange}
            options={providers.map((item) => ({
              value: item.id,
              label: item.label,
            }))}
            className={`${NODE_CONTROL_CHIP_CLASS} min-w-0 flex-1 border border-border-dark bg-bg-dark text-text-dark outline-none`}
            previewClassName={`${NODE_CONTROL_CHIP_CLASS} min-w-0 flex-1 border border-border-dark bg-bg-dark/60 text-text-dark`}
          />
        </div>

        {isLocalZImage ? (
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[11px] text-text-muted">尺寸</label>
            <NodeEditableSelect
              selected={selected}
              value={String(imageSize)}
              disabled={isRunning}
              onEnterEditing={() => setSelectedNode(id)}
              onValueChange={(nextValue) => {
                const nextSize = normalizeZImageSize(Number(nextValue));
                updateNodeData(id, {
                  imageSize: nextSize,
                  generationDurationMs: estimateZImageDurationMs(nextSize),
                });
              }}
              options={ZIMAGE_SIZE_OPTIONS.map((option) => ({
                value: String(option.value),
                label: option.label,
              }))}
              className={`${NODE_CONTROL_CHIP_CLASS} min-w-0 flex-1 border border-border-dark bg-bg-dark text-text-dark outline-none`}
              previewClassName={`${NODE_CONTROL_CHIP_CLASS} min-w-0 flex-1 border border-border-dark bg-bg-dark/60 text-text-dark`}
            />
          </div>
        ) : null}

        {isLocalZImage ? (
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border-dark bg-bg-dark">
            {isZImageReady ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <p className="text-xs leading-5 text-emerald-200">
                  本地 Z-Image 已就绪
                </p>
                <p className="text-[11px] leading-5 text-text-muted">
                  在下方输入提示词后点击「生成」即可出图
                </p>
              </div>
            ) : isZImageModelLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <Loader2 className="h-7 w-7 animate-spin text-accent" />
                <p className="text-xs text-text-dark">
                  {localZImageStatus?.model_phase || '模型加载中…'}
                </p>
                <p className="text-[11px] tabular-nums text-accent">
                  {Math.round(localZImageStatus?.model_progress ?? 0)}%
                </p>
                <p className="text-[10px] leading-5 text-text-muted">
                  可在插件列表中查看详情；加载完成后即可生成
                </p>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-400" />
                <p className="text-xs leading-5 text-text-muted">
                  本地 Z-Image 服务未开启或未就绪，无法生成。请前往
                  {' '}
                  <span className="text-text-dark">项目管理 → 插件列表</span>
                  {' '}
                  完成安装与启动。
                </p>
                <UiButton
                  type="button"
                  size="sm"
                  variant="muted"
                  onClick={() => navigateToProjectHomeTab('plugins')}
                >
                  前往插件列表
                </UiButton>
              </div>
            )}
            {isRunning ? (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-dark/70 text-xs text-text-muted">
                正在本地生成…
              </div>
            ) : null}
          </div>
        ) : provider?.embedUrl ? (
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
          <NodeEditableTextarea
            selected={selected}
            value={promptDraft}
            disabled={isRunning}
            onEnterEditing={() => setSelectedNode(id)}
            onValueChange={setPromptDraft}
            onBlur={() => commitPromptDraft(promptDraft)}
            placeholder={provider?.inputs.find((port) => port.id === 'prompt')?.label ?? '输入提示词'}
            className="ui-scrollbar h-full min-h-[56px] w-full resize-none border-none bg-transparent text-sm leading-6 text-text-dark outline-none placeholder:text-text-muted/80"
            previewClassName="min-h-[56px] text-sm leading-6 text-text-dark"
            emptyPreview={<div className="text-sm text-text-muted/80">双击编辑提示词</div>}
          />
          {upstreamTexts.length > 0 ? (
            <div className="mt-1 text-[10px] text-text-muted">
              已连接 {upstreamTexts.length} 个文本输入
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border-dark px-3 py-2">
        {isLocalZImage ? (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-[10px] text-accent hover:underline"
            onClick={() => navigateToProjectHomeTab('plugins')}
          >
            前往插件列表配置 Z-Image
          </button>
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-[10px] text-accent hover:underline"
            onClick={() => openLocalZImageInstallDialog({ focusCurrentStep: true })}
          >
            打开本地 Z-Image 安装向导
          </button>
        )}
        <UiButton
          type="button"
          size="sm"
          variant="primary"
          disabled={isRunning || (isLocalZImage && !isZImageReady)}
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
