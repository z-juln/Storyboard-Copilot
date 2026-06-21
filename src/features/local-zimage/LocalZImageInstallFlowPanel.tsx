import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Play } from 'lucide-react';

import { UiButton, UiModal } from '@/components/ui';
import type { LocalZImageInstallStepDefinition } from '@/features/local-zimage/installFlow';
import {
  formatSkippedPythonNote,
  listVisibleInstallSteps,
  resolveStepPresentation,
  resolveVisibleStepState,
} from '@/features/local-zimage/installFlowPresentation';
import {
  isLocalZImageFullyReady,
  LocalZImageModelLoadBanner,
} from '@/features/local-zimage/LocalZImageModelLoadBanner';
import { useLocalZImageInstallFlow } from '@/features/local-zimage/useLocalZImageInstallFlow';

interface LocalZImageInstallFlowPanelProps {
  compact?: boolean;
  className?: string;
}

export function LocalZImageInstallFlowPanel({
  compact = false,
  className = '',
}: LocalZImageInstallFlowPanelProps) {
  const {
    apiOnline,
    status,
    busyStepId,
    error,
    successMessage,
    recommendedStep,
    runStep,
    stopServer,
    warmupModel,
  } = useLocalZImageInstallFlow();
  const [confirmStep, setConfirmStep] = useState<LocalZImageInstallStepDefinition | null>(null);
  const wasInstallRunningRef = useRef(false);
  const autoPromptedStepRef = useRef<string | null>(null);

  const allReady = isLocalZImageFullyReady(status);

  const stepItems = useMemo(
    () => listVisibleInstallSteps(status).map((step) => ({
      step,
      presentation: resolveStepPresentation(step, status),
      state: resolveVisibleStepState(step.id, status),
    })),
    [status]
  );

  const skippedPythonNote = formatSkippedPythonNote(status);

  useEffect(() => {
    if (!status || !recommendedStep) {
      return;
    }

    const justFinishedStep = wasInstallRunningRef.current && !status.install_running;
    wasInstallRunningRef.current = status.install_running;

    if (
      justFinishedStep
      && !status.install_error
      && busyStepId === null
      && !confirmStep
      && autoPromptedStepRef.current !== recommendedStep.id
    ) {
      autoPromptedStepRef.current = recommendedStep.id;
      setConfirmStep(recommendedStep);
    }
  }, [busyStepId, confirmStep, recommendedStep, status]);

  if (apiOnline === false) {
    return (
      <div className={`rounded-lg border border-border-dark bg-bg-dark p-4 text-sm text-text-muted ${className}`}>
        本地 API 未连接。Web 端请先运行
        {' '}
        <code className="text-accent">cargo run --bin video-api</code>
        ；桌面端请使用 Tauri 启动应用。
      </div>
    );
  }

  return (
    <div className={`${compact ? 'space-y-3' : 'space-y-4'} ${className}`}>
      <div className={compact ? 'space-y-3' : 'rounded-lg border border-border-dark bg-bg-dark p-4'}>
        {!compact ? (
          <>
            <h3 className="text-sm font-medium text-text-dark">本地 Z-Image 安装向导</h3>
            <p className="mt-1 text-xs text-text-muted">
              外部科技节点依赖本机 Z-Image 服务。每个大步骤开始前都会请求确认，可按顺序完成安装与启动。
            </p>
          </>
        ) : null}

        {allReady ? (
          <div className={`rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200${compact ? '' : ' mt-3'}`}>
            本地 Z-Image 已就绪（{status?.server_url}），模型已加载，可在外部科技节点中直接生成。
          </div>
        ) : null}

        {status?.server_running && !status.model_loaded ? (
          <div className={compact ? '' : 'mt-3'}>
            <LocalZImageModelLoadBanner
              status={status}
              warmupDisabled={busyStepId !== null}
              onWarmup={() => {
                void warmupModel();
              }}
            />
          </div>
        ) : null}

        {status?.model_error ? (
          <p className={`text-xs text-red-400${compact ? '' : ' mt-3'}`}>模型加载失败：{status.model_error}</p>
        ) : null}

        {successMessage ? (
          <div className={`rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200${compact ? '' : ' mt-3'}`}>
            {successMessage}
          </div>
        ) : null}

        {status?.server_detached ? (
          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100${compact ? '' : ' mt-3'}`}>
            <span>
              检测到上次未关闭的 Z-Image 服务（{status.server_url}），模型可能仍在内存中，可直接生成。
            </span>
            <UiButton
              size="sm"
              variant="muted"
              disabled={busyStepId !== null}
              onClick={() => {
                void stopServer();
              }}
            >
              停止遗留服务
            </UiButton>
          </div>
        ) : null}

        {skippedPythonNote ? (
          <div className={`rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200${compact ? '' : ' mt-3'}`}>
            {skippedPythonNote}
          </div>
        ) : null}

        <ol className={`${compact ? 'space-y-2' : 'mt-4 space-y-3'}`}>
          {stepItems.map(({ step, presentation, state }) => {
            const isRunningStep =
              Boolean(status?.install_running) && recommendedStep?.id === step.id;

            return (
              <li
                key={step.id}
                className={`rounded-md border px-3 ${compact ? 'py-1.5' : 'py-2'} ${
                  state === 'active'
                    ? 'border-accent/40 bg-accent/5'
                    : 'border-border-dark bg-surface-dark/40'
                }`}
              >
                <div className="flex items-start gap-2">
                  <StepIcon state={state} running={isRunningStep} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-text-dark">{presentation.title}</div>
                    <div className="mt-0.5 text-xs text-text-muted">{presentation.summary}</div>
                    {isRunningStep ? (
                      <div className="mt-1 text-[11px] text-accent">
                        进行中：{status?.install_phase || '处理中'}
                        {' '}
                        ({Math.round(status?.install_progress ?? 0)}%)
                      </div>
                    ) : null}
                    {state === 'active' && !status?.install_running ? (
                      <div className="mt-1 text-[11px] text-accent/90">
                        请点击「继续」确认执行此步骤
                      </div>
                    ) : null}
                  </div>
                  {state === 'active' && !status?.install_running ? (
                    <UiButton
                      size="sm"
                      disabled={busyStepId !== null}
                      onClick={() => setConfirmStep(step)}
                    >
                      继续
                    </UiButton>
                  ) : null}
                  {step.id === 'start-server' && status?.server_running ? (
                    <UiButton
                      size="sm"
                      variant="muted"
                      disabled={busyStepId !== null}
                      onClick={() => {
                        void stopServer();
                      }}
                    >
                      停止
                    </UiButton>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        {error ? (
          <p className={`text-xs text-red-400${compact ? '' : ' mt-3'}`}>{error}</p>
        ) : null}

        {status?.install_running && recommendedStep ? (
          <div className={`flex items-center gap-2 text-xs text-accent${compact ? ' mt-2' : ' mt-4'}`}>
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            <span>
              正在执行：{status.install_phase || '处理中'}
              {' '}
              ({Math.round(status.install_progress)}%)，请勿关闭应用
            </span>
          </div>
        ) : null}

        {!allReady && recommendedStep && !status?.install_running ? (
          <div className={compact ? 'mt-2' : 'mt-4'}>
            <UiButton
              size="sm"
              disabled={busyStepId !== null}
              onClick={() => setConfirmStep(recommendedStep)}
            >
              {busyStepId ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Play className="mr-1 h-3 w-3" />
              )}
              执行下一步：{resolveStepPresentation(recommendedStep, status).title}
            </UiButton>
          </div>
        ) : null}
      </div>

      {status?.log_tail?.length ? (
        <div className={compact ? '' : 'rounded-lg border border-border-dark bg-bg-dark p-4'}>
          <h4 className="text-xs font-medium text-text-dark">安装日志</h4>
          <pre className={`mt-2 whitespace-pre-wrap text-[11px] text-text-muted ${compact ? '' : 'ui-scrollbar max-h-48 overflow-auto'}`}>
            {status.log_tail.join('\n')}
          </pre>
        </div>
      ) : null}

      <UiModal
        isOpen={Boolean(confirmStep)}
        title={confirmStep?.confirmTitle ?? '确认步骤'}
        onClose={() => setConfirmStep(null)}
      >
        <p className="text-sm text-text-muted">{confirmStep?.confirmMessage}</p>
        <div className="mt-4 flex justify-end gap-2">
          <UiButton variant="muted" onClick={() => setConfirmStep(null)}>
            取消
          </UiButton>
          <UiButton
            variant="primary"
            disabled={busyStepId !== null}
            onClick={() => {
              if (!confirmStep) {
                return;
              }
              const step = confirmStep;
              setConfirmStep(null);
              void runStep(step);
            }}
          >
            确认并继续
          </UiButton>
        </div>
      </UiModal>
    </div>
  );
}

function StepIcon({
  state,
  running,
}: {
  state: ReturnType<typeof resolveVisibleStepState>;
  running: boolean;
}) {
  if (state === 'done' || state === 'skipped') {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />;
  }
  if (state === 'active' && running) {
    return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-accent" />;
  }
  if (state === 'active') {
    return <Circle className="mt-0.5 h-4 w-4 shrink-0 fill-accent/20 text-accent" />;
  }
  return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-text-muted/60" />;
}
