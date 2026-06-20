import type { Viewport } from '@xyflow/react';

import { canvasNodeFactory } from '@/features/canvas/application/canvasServices';
import {
  CANVAS_NODE_TYPES,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeType,
} from '@/features/canvas/domain/canvasNodes';
import { canvasNodeDefinitions } from '@/features/canvas/domain/nodeRegistry';
import { DEFAULT_IMAGE_MODEL_ID } from '@/features/canvas/models';
import type { Project, ProjectSummary } from '@/stores/projectStore';

import {
  COMPONENT_DOC_PROJECT_ID,
  COMPONENT_DOC_PROJECT_NAME,
} from './constants';
import { DOC_PLACEHOLDER_IMAGE, DOC_SAMPLE_IMAGE } from './placeholders';

const DOC_VIEWPORT: Viewport = { x: 24, y: 24, zoom: 0.58 };

function defaultsFor<T extends CanvasNodeType>(type: T) {
  return canvasNodeDefinitions[type].createDefaultData();
}

function withMeta(
  node: CanvasNode,
  id: string,
  options?: {
    parentId?: string;
    position?: { x: number; y: number };
    style?: { width?: number; height?: number };
  }
): CanvasNode {
  return {
    ...node,
    id,
    ...(options?.parentId
      ? { parentId: options.parentId, extent: 'parent' as const }
      : {}),
    position: options?.position ?? node.position,
    style: options?.style ? { ...node.style, ...options.style } : node.style,
  };
}

function docTextNode(
  id: string,
  parentId: string,
  position: { x: number; y: number },
  content: string,
  size: { width: number; height: number }
): CanvasNode {
  const node = canvasNodeFactory.createNode(CANVAS_NODE_TYPES.textAnnotation, position, {
    ...defaultsFor(CANVAS_NODE_TYPES.textAnnotation),
    displayName: '说明',
    content,
  });
  return withMeta(node, id, { parentId, position, style: size });
}

function buildComponentDocNodes(): CanvasNode[] {
  const uploadDefaults = defaultsFor(CANVAS_NODE_TYPES.upload);
  const imageEditDefaults = defaultsFor(CANVAS_NODE_TYPES.imageEdit);
  const exportDefaults = defaultsFor(CANVAS_NODE_TYPES.exportImage);
  const splitDefaults = defaultsFor(CANVAS_NODE_TYPES.storyboardSplit);
  const genDefaults = defaultsFor(CANVAS_NODE_TYPES.storyboardGen);

  const groupInput = withMeta(
    canvasNodeFactory.createNode(CANVAS_NODE_TYPES.group, { x: 80, y: 80 }, {
      displayName: '图片输入 · uploadNode',
      label: '图片输入 · uploadNode',
    }),
    'doc-group-input',
    { style: { width: 920, height: 520 } }
  );

  const groupAi = withMeta(
    canvasNodeFactory.createNode(CANVAS_NODE_TYPES.group, { x: 1080, y: 80 }, {
      displayName: 'AI 生图 · imageNode / exportImageNode',
      label: 'AI 生图 · imageNode / exportImageNode',
    }),
    'doc-group-ai',
    { style: { width: 920, height: 520 } }
  );

  const groupStoryboard = withMeta(
    canvasNodeFactory.createNode(CANVAS_NODE_TYPES.group, { x: 80, y:680 }, {
      displayName: '分镜 · storyboardNode / storyboardGenNode',
      label: '分镜 · storyboardNode / storyboardGenNode',
    }),
    'doc-group-storyboard',
    { style: { width: 920, height: 480 } }
  );

  const groupMeta = withMeta(
    canvasNodeFactory.createNode(CANVAS_NODE_TYPES.group, { x: 1080, y: 680 }, {
      displayName: '注释与容器 · textAnnotationNode / groupNode',
      label: '注释与容器 · textAnnotationNode / groupNode',
    }),
    'doc-group-meta',
    { style: { width: 920, height: 360 } }
  );

  const intro = docTextNode(
    'doc-intro',
    'doc-group-input',
    { x: 24, y: 48 },
    [
      '# Component Doc',
      '',
      '本页是**开发环境专用**的内置项目，交互与正式画布一致（右键添加、拖线连线、工具条、撤销等）。',
      '',
      '- 组件示例按**分组**归类',
      '- 详细说明用 **textAnnotationNode**（本节点类型）',
      '- **不写入本地数据库**；刷新或重新打开本项目会恢复初始内容',
      '',
      '注册表：`canvasNodes.ts` → `nodeRegistry.ts` → `nodes/index.ts`',
    ].join('\n'),
    { width: 860, height: 200 }
  );

  const uploadDoc = docTextNode(
    'doc-upload-text',
    'doc-group-input',
    { x: 24, y: 268 },
    [
      '## uploadNode · `UploadNode.tsx`',
      '',
      '- 菜单可见；仅 **Source** Handle',
      '- 点击 / 拖拽 / 重新上传；落盘走 HTTP 分片',
      '- 字段：`imageUrl` `previewImageUrl` `aspectRatio` `sourceFileName`',
    ].join('\n'),
    { width: 400, height: 180 }
  );

  const uploadEmpty = withMeta(
    canvasNodeFactory.createNode(CANVAS_NODE_TYPES.upload, { x: 460, y: 268 }, uploadDefaults),
    'doc-upload-empty',
    { parentId: 'doc-group-input', position: { x: 460, y: 268 }, style: { width: 200, height: 200 } }
  );

  const uploadFilled = withMeta(
    canvasNodeFactory.createNode(
      CANVAS_NODE_TYPES.upload,
      { x: 680, y: 268 },
      {
        ...uploadDefaults,
        imageUrl: DOC_SAMPLE_IMAGE,
        previewImageUrl: DOC_SAMPLE_IMAGE,
        aspectRatio: '16:9',
        sourceFileName: 'sample.png',
        displayName: '已上传示例',
      }
    ),
    'doc-upload-filled',
    { parentId: 'doc-group-input', position: { x: 680, y: 268 }, style: { width: 220, height: 180 } }
  );

  const aiDoc = docTextNode(
    'doc-ai-text',
    'doc-group-ai',
    { x: 24, y: 48 },
    [
      '## imageNode · `ImageEditNode.tsx`',
      '',
      '- 菜单：**AI 图片**；Source + Target',
      '- Prompt、模型参数、生成进度；结果生成下游 **exportImageNode**',
      '',
      '## exportImageNode · `ImageNode.tsx`',
      '',
      '- 菜单隐藏；工具/AI 产物只读展示',
      '- `resultKind`：generic / storyboardGenOutput / …',
    ].join('\n'),
    { width: 420, height: 260 }
  );

  const imageEditEmpty = withMeta(
    canvasNodeFactory.createNode(CANVAS_NODE_TYPES.imageEdit, { x: 480, y: 48 }, imageEditDefaults),
    'doc-image-edit-empty',
    { parentId: 'doc-group-ai', position: { x: 480, y: 48 }, style: { width: 380, height: 288 } }
  );

  const imageEditFilled = withMeta(
    canvasNodeFactory.createNode(
      CANVAS_NODE_TYPES.imageEdit,
      { x: 480, y: 360 },
      {
        ...imageEditDefaults,
        imageUrl: DOC_SAMPLE_IMAGE,
        previewImageUrl: DOC_SAMPLE_IMAGE,
        aspectRatio: '16:9',
        prompt: '示例 prompt：赛博朋克雨夜街道',
        model: DEFAULT_IMAGE_MODEL_ID,
        displayName: 'AI 图片 · 示例',
      }
    ),
    'doc-image-edit-filled',
    { parentId: 'doc-group-ai', position: { x: 480, y: 360 }, style: { width: 380, height: 288 } }
  );

  const exportGeneric = withMeta(
    canvasNodeFactory.createNode(
      CANVAS_NODE_TYPES.exportImage,
      { x: 24, y: 360 },
      {
        ...exportDefaults,
        imageUrl: DOC_SAMPLE_IMAGE,
        previewImageUrl: DOC_SAMPLE_IMAGE,
        aspectRatio: '16:9',
        resultKind: 'generic',
      }
    ),
    'doc-export-generic',
    { parentId: 'doc-group-ai', position: { x: 24, y: 360 }, style: { width: 320, height: 200 } }
  );

  const storyboardDoc = docTextNode(
    'doc-storyboard-text',
    'doc-group-storyboard',
    { x: 24, y: 48 },
    [
      '## storyboardNode · `StoryboardNode.tsx`',
      '',
      '- 分镜切割结果；网格帧 + 导出选项',
      '',
      '## storyboardGenNode · `StoryboardGenNode.tsx`',
      '',
      '- 菜单：**分镜生成**；按格子描述批量 AI 生帧',
    ].join('\n'),
    { width: 360, height: 200 }
  );

  const storyboardSplit = withMeta(
    canvasNodeFactory.createNode(
      CANVAS_NODE_TYPES.storyboardSplit,
      { x: 420, y: 48 },
      {
        ...splitDefaults,
        gridRows: 2,
        gridCols: 2,
        frames: [
          {
            id: 'doc-frame-1',
            imageUrl: DOC_SAMPLE_IMAGE,
            previewImageUrl: DOC_PLACEHOLDER_IMAGE,
            aspectRatio: '16:9',
            note: '帧 1',
            order: 0,
          },
          {
            id: 'doc-frame-2',
            imageUrl: DOC_PLACEHOLDER_IMAGE,
            previewImageUrl: DOC_PLACEHOLDER_IMAGE,
            aspectRatio: '16:9',
            note: '',
            order: 1,
          },
          {
            id: 'doc-frame-3',
            imageUrl: DOC_PLACEHOLDER_IMAGE,
            previewImageUrl: DOC_PLACEHOLDER_IMAGE,
            aspectRatio: '16:9',
            note: '',
            order: 2,
          },
          {
            id: 'doc-frame-4',
            imageUrl: DOC_PLACEHOLDER_IMAGE,
            previewImageUrl: DOC_PLACEHOLDER_IMAGE,
            aspectRatio: '16:9',
            note: '帧 4',
            order: 3,
          },
        ],
      }
    ),
    'doc-storyboard-split',
    { parentId: 'doc-group-storyboard', position: { x: 420, y: 48 }, style: { width: 460, height: 360 } }
  );

  const storyboardGen = withMeta(
    canvasNodeFactory.createNode(
      CANVAS_NODE_TYPES.storyboardGen,
      { x: 24, y: 280 },
      {
        ...genDefaults,
        frames: [
          { id: 'doc-gen-1', description: '开场远景', referenceIndex: null },
          { id: 'doc-gen-2', description: '人物特写', referenceIndex: 0 },
          { id: 'doc-gen-3', description: '室内场景', referenceIndex: null },
          { id: 'doc-gen-4', description: '结尾拉远', referenceIndex: 2 },
        ],
      }
    ),
    'doc-storyboard-gen',
    { parentId: 'doc-group-storyboard', position: { x: 24, y: 280 }, style: { width: 380, height: 400 } }
  );

  const metaDoc = docTextNode(
    'doc-meta-text',
    'doc-group-meta',
    { x: 24, y: 48 },
    [
      '## textAnnotationNode',
      '',
      '本节点即说明载体，支持 Markdown（GFM）。',
      '',
      '## groupNode · `GroupNode.tsx`',
      '',
      '框选多节点后可分组；本页各区块外层分组即为 groupNode。',
      '',
      '操作与正式项目相同：右键画布、拖线到空白处出菜单、Alt 拖拽复制等。',
    ].join('\n'),
    { width: 520, height: 280 }
  );

  const metaExampleText = withMeta(
    canvasNodeFactory.createNode(CANVAS_NODE_TYPES.textAnnotation, { x: 580, y: 48 }, {
      ...defaultsFor(CANVAS_NODE_TYPES.textAnnotation),
      displayName: '短注释示例',
      content: '独立 textAnnotationNode，不参与图片连线。',
    }),
    'doc-meta-text-node',
    { parentId: 'doc-group-meta', position: { x: 580, y: 48 }, style: { width: 300, height: 160 } }
  );

  return [
    groupInput,
    groupAi,
    groupStoryboard,
    groupMeta,
    intro,
    uploadDoc,
    uploadEmpty,
    uploadFilled,
    aiDoc,
    imageEditEmpty,
    imageEditFilled,
    exportGeneric,
    storyboardDoc,
    storyboardSplit,
    storyboardGen,
    metaDoc,
    metaExampleText,
  ];
}

function buildComponentDocEdges(): CanvasEdge[] {
  return [
    {
      id: 'doc-edge-upload-to-edit',
      source: 'doc-upload-filled',
      target: 'doc-image-edit-filled',
      type: 'disconnectableEdge',
    },
    {
      id: 'doc-edge-edit-to-export',
      source: 'doc-image-edit-filled',
      target: 'doc-export-generic',
      type: 'disconnectableEdge',
    },
  ];
}

export function buildComponentDocProject(): Project {
  const nodes = buildComponentDocNodes();
  const edges = buildComponentDocEdges();
  const now = Date.now();

  return {
    id: COMPONENT_DOC_PROJECT_ID,
    name: COMPONENT_DOC_PROJECT_NAME,
    createdAt: now,
    updatedAt: now,
    nodeCount: nodes.length,
    nodes,
    edges,
    viewport: DOC_VIEWPORT,
    history: { past: [], future: [] },
  };
}

export function getComponentDocProjectSummary(): ProjectSummary {
  const project = buildComponentDocProject();
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    nodeCount: project.nodeCount,
  };
}

export function mergeComponentDocProjectSummaries(projects: ProjectSummary[]): ProjectSummary[] {
  const withoutDoc = projects.filter((project) => project.id !== COMPONENT_DOC_PROJECT_ID);
  return [getComponentDocProjectSummary(), ...withoutDoc];
}
