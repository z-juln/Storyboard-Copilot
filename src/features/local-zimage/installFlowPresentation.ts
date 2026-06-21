import type { LocalZImageStatus } from '@/features/canvas/external-tech/types';

import {
  LOCAL_ZIMAGE_INSTALL_FLOW,
  resolveStepState,
  type LocalZImageInstallStepDefinition,
  type LocalZImageInstallStepId,
} from './installFlow';

export function shouldShowPythonStep(status: LocalZImageStatus | null): boolean {
  if (!status) {
    return false;
  }
  if (status.system_python_detected) {
    return false;
  }
  if (!status.completed_steps.includes('prepare')) {
    return false;
  }
  return true;
}

export function listVisibleInstallSteps(
  status: LocalZImageStatus | null
): LocalZImageInstallStepDefinition[] {
  return LOCAL_ZIMAGE_INSTALL_FLOW.filter((step) => {
    if (step.id === 'python') {
      return shouldShowPythonStep(status);
    }
    return true;
  });
}

export function resolveStepPresentation(
  step: LocalZImageInstallStepDefinition,
  status: LocalZImageStatus | null
): { title: string; summary: string } {
  const visibleSteps = listVisibleInstallSteps(status);
  const order = visibleSteps.findIndex((item) => item.id === step.id);
  const label = step.title.replace(/^\d+\.\s*/, '');

  if (step.id === 'prepare') {
    const title = order >= 0 ? `${order + 1}. ${label}` : step.title;
    if (status?.system_python_detected && !status.completed_steps.includes('prepare')) {
      const pythonHint = status.detected_system_python
        ? `：${status.detected_system_python}`
        : '';
      return {
        title,
        summary: `创建本地安装目录（系统 Python 已就绪${pythonHint}，无需额外配置）`,
      };
    }
    return {
      title,
      summary: step.summary,
    };
  }

  if (step.id === 'python' && status?.system_python_detected === false) {
    return {
      title: order >= 0 ? `${order + 1}. ${label}` : step.title,
      summary: '未检测到 Python 3.10+，将通过 uv 安装 Python 3.12',
    };
  }

  return {
    title: order >= 0 ? `${order + 1}. ${label}` : step.title,
    summary: step.summary,
  };
}

export function resolveVisibleStepState(
  stepId: LocalZImageInstallStepId,
  status: LocalZImageStatus | null
): ReturnType<typeof resolveStepState> {
  if (stepId === 'python' && !shouldShowPythonStep(status)) {
    return 'skipped';
  }
  return resolveStepState(stepId, status);
}

export function formatSkippedPythonNote(status: LocalZImageStatus | null): string | null {
  if (!status?.system_python_detected) {
    return null;
  }
  const path = status.detected_system_python ?? status.python_path;
  const pathHint = path ? `（${path}）` : '';
  if (status.completed_steps.includes('python')) {
    return `已检测到系统 Python${pathHint}，已自动跳过「配置 Python」步骤。`;
  }
  if (!status.completed_steps.includes('prepare')) {
    return `已检测到系统 Python${pathHint}，无需「配置 Python」步骤，可直接从「准备安装」开始。`;
  }
  return null;
}
