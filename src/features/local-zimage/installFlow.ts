export type LocalZImageInstallStepId =
  | 'prepare'
  | 'python'
  | 'venv'
  | 'dependencies'
  | 'finalize'
  | 'start-server';

export interface LocalZImageInstallStepDefinition {
  id: LocalZImageInstallStepId;
  title: string;
  summary: string;
  confirmTitle: string;
  confirmMessage: string;
  apiStep?: LocalZImageInstallStepId;
}

export const LOCAL_ZIMAGE_INSTALL_FLOW: LocalZImageInstallStepDefinition[] = [
  {
    id: 'prepare',
    title: '1. 准备安装',
    summary: '创建本地目录并检测 Python 环境',
    confirmTitle: '开始准备安装？',
    confirmMessage:
      '将创建本地 Z-Image 目录，并检测系统是否已有 Python 3.10+。若已安装合适版本，将自动跳过「配置 Python」步骤。请确保磁盘可用空间 ≥ 20GB，且后续步骤需要稳定网络。',
    apiStep: 'prepare',
  },
  {
    id: 'python',
    title: '2. 配置 Python',
    summary: '使用系统 Python，或通过 uv 安装 Python 3.12',
    confirmTitle: '继续配置 Python？',
    confirmMessage:
      '若系统无合适 Python，将下载 uv 并安装 Python 3.12 到应用数据目录（无需 Homebrew，通常无需管理员权限）。',
    apiStep: 'python',
  },
  {
    id: 'venv',
    title: '3. 创建虚拟环境',
    summary: '隔离 Z-Image 依赖，避免污染系统 Python',
    confirmTitle: '创建虚拟环境？',
    confirmMessage: '将在本地目录创建独立 venv，用于安装 torch、diffusers、gradio 等依赖。',
    apiStep: 'venv',
  },
  {
    id: 'dependencies',
    title: '4. 安装依赖包',
    summary: '安装 PyTorch、diffusers、Gradio（耗时最长）',
    confirmTitle: '开始安装依赖？',
    confirmMessage:
      '此步骤可能耗时 10–30 分钟，取决于网络速度。安装过程中请勿关闭应用或本地 API 服务。',
    apiStep: 'dependencies',
  },
  {
    id: 'finalize',
    title: '5. 完成安装',
    summary: '写入 Gradio 服务脚本并标记安装完成',
    confirmTitle: '完成安装配置？',
    confirmMessage: '将写入本地 Gradio 启动脚本。完成后即可启动 Z-Image 服务。',
    apiStep: 'finalize',
  },
  {
    id: 'start-server',
    title: '6. 启动本地服务',
    summary: '启动 http://127.0.0.1:7860，供外部科技节点调用',
    confirmTitle: '启动本地 Z-Image 服务？',
    confirmMessage:
      '将启动独立 Gradio 进程（关闭 Storyboard 应用后仍会继续运行，便于保留已加载的模型）。首次生成仍需加载模型，可能较慢。不需要时可在设置或安装向导中手动停止。',
  },
];

export function resolveStepState(
  stepId: LocalZImageInstallStepId,
  status: {
    completed_steps: string[];
    installed: boolean;
    server_running: boolean;
    next_recommended_step?: string | null;
  } | null
): 'pending' | 'active' | 'done' | 'skipped' {
  if (!status) {
    return 'pending';
  }

  if (stepId === 'start-server') {
    if (status.server_running) {
      return 'done';
    }
    return status.installed ? 'active' : 'pending';
  }

  if (status.completed_steps.includes(stepId)) {
    return 'done';
  }

  const flowIndex = LOCAL_ZIMAGE_INSTALL_FLOW.findIndex((item) => item.id === stepId);
  const previousSteps = LOCAL_ZIMAGE_INSTALL_FLOW.slice(0, flowIndex).filter((item) => item.apiStep);
  const previousDone = previousSteps.every((item) =>
    item.apiStep ? status.completed_steps.includes(item.apiStep) : true
  );

  if (!previousDone) {
    return 'pending';
  }

  if (status.next_recommended_step === stepId) {
    return 'active';
  }

  return 'pending';
}
