import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { UiButton, UiTextArea } from '@/components/ui';
import {
  BUILTIN_ADAPTER_SUMMARIES,
  DEEPSEEK_FLASH_ADAPTER_ID,
  KLING_V3_T2V_ADAPTER_ID,
} from '@/features/aiModels';
import {
  pollAdapterUntilDone,
  rustApiClient,
} from '@/infrastructure/rustApiClient';

const CAPABILITY_LABELS: Record<string, string> = {
  chat: '对话',
  'text-to-video': '文生视频',
};

export function BuiltinModelsPanel() {
  const adapters = useMemo(() => BUILTIN_ADAPTER_SUMMARIES, []);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [deepseekPrompt, setDeepseekPrompt] = useState('用一句话介绍你自己。');
  const [klingPrompt, setKlingPrompt] = useState('电影感无人机镜头，穿过古代石制废墟，黄金时刻。');
  const [deepseekResult, setDeepseekResult] = useState<string | null>(null);
  const [klingResult, setKlingResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runningAdapterId, setRunningAdapterId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    rustApiClient
      .health()
      .then(() => {
        if (!cancelled) {
          setApiOnline(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiOnline(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runDeepseek = useCallback(async () => {
    setRunningAdapterId(DEEPSEEK_FLASH_ADAPTER_ID);
    setError(null);
    setDeepseekResult(null);
    try {
      const result = await rustApiClient.invokeAdapter({
        adapterId: DEEPSEEK_FLASH_ADAPTER_ID,
        input: { prompt: deepseekPrompt },
      });
      if (result.status === 'succeeded') {
        const text = result.outputs.find((output) => output.type === 'text');
        setDeepseekResult(text?.type === 'text' ? text.text : JSON.stringify(result.outputs));
      } else if (result.status === 'failed') {
        setError(result.error);
      }
    } catch (invokeError) {
      setError(invokeError instanceof Error ? invokeError.message : String(invokeError));
    } finally {
      setRunningAdapterId(null);
    }
  }, [deepseekPrompt]);

  const runKling = useCallback(async () => {
    setRunningAdapterId(KLING_V3_T2V_ADAPTER_ID);
    setError(null);
    setKlingResult(null);
    try {
      const initial = await rustApiClient.invokeAdapter({
        adapterId: KLING_V3_T2V_ADAPTER_ID,
        input: {
          prompt: klingPrompt,
          aspectRatio: '16:9',
        },
        params: { duration: '5' },
      });

      const finalResult =
        initial.status === 'queued' || initial.status === 'running'
          ? await pollAdapterUntilDone({
              adapterId: KLING_V3_T2V_ADAPTER_ID,
              task: initial.task,
            })
          : initial;

      if (finalResult.status === 'succeeded') {
        const video = finalResult.outputs.find((output) => output.type === 'video');
        setKlingResult(video?.type === 'video' ? video.url ?? '生成成功，但未返回 URL' : JSON.stringify(finalResult.outputs));
      } else if (finalResult.status === 'failed') {
        setError(finalResult.error);
      }
    } catch (invokeError) {
      setError(invokeError instanceof Error ? invokeError.message : String(invokeError));
    } finally {
      setRunningAdapterId(null);
    }
  }, [klingPrompt]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-text-dark">内置模型</h2>
        <p className="mt-1 text-sm text-text-muted">
          通过本地 Rust HTTP API 调用内置模型。默认使用应用内置密钥，可在下方覆盖。
        </p>
        {apiOnline === false ? (
          <p className="mt-2 text-sm text-red-400">
            本地 API 未启动。请运行 `npm run tauri dev` 或 `cargo run --bin storyboard-api`。
          </p>
        ) : null}
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-text-dark">已接入</h3>
        <div className="space-y-2">
          {adapters.map((adapter) => (
            <div
              key={adapter.id}
              className="rounded-lg border border-border-dark bg-bg-dark p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-text-dark">{adapter.displayName}</span>
                <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">内置</span>
                <span className="rounded bg-surface-dark px-2 py-0.5 text-xs text-text-muted">
                  {CAPABILITY_LABELS[adapter.capability] ?? adapter.capability}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-muted">{adapter.modelId}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border-dark bg-bg-dark p-4">
        <h3 className="text-sm font-medium text-text-dark">测试 DeepSeek V4 Flash</h3>
        <UiTextArea
          value={deepseekPrompt}
          onChange={(event) => setDeepseekPrompt(event.target.value)}
          rows={3}
        />
        <UiButton
          variant="primary"
          size="sm"
          disabled={runningAdapterId !== null || !deepseekPrompt.trim() || apiOnline === false}
          onClick={runDeepseek}
        >
          {runningAdapterId === DEEPSEEK_FLASH_ADAPTER_ID ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-1 h-4 w-4" />
          )}
          运行对话
        </UiButton>
        {deepseekResult ? (
          <pre className="ui-field max-h-48 overflow-auto border p-3 text-xs whitespace-pre-wrap text-text-dark">
            {deepseekResult}
          </pre>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border border-border-dark bg-bg-dark p-4">
        <h3 className="text-sm font-medium text-text-dark">测试 Kling 3.0 文生视频</h3>
        <UiTextArea
          value={klingPrompt}
          onChange={(event) => setKlingPrompt(event.target.value)}
          rows={3}
        />
        <UiButton
          variant="primary"
          size="sm"
          disabled={runningAdapterId !== null || !klingPrompt.trim() || apiOnline === false}
          onClick={runKling}
        >
          {runningAdapterId === KLING_V3_T2V_ADAPTER_ID ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-1 h-4 w-4" />
          )}
          生成视频
        </UiButton>
        {klingResult ? (
          <p className="break-all text-xs text-text-dark">{klingResult}</p>
        ) : null}
      </section>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
