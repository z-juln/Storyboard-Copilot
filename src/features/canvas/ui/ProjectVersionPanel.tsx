import { memo, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

import { revealProjectAsset } from '@/features/canvas/application/assetExplorerRevealBridge';
import { SimpleAssetDiffDialog } from '@/features/canvas/ui/git/SimpleAssetDiffDialog';
import { GitChangesSection } from '@/features/canvas/ui/git/GitChangesSection';
import { GitCommitForm } from '@/features/canvas/ui/git/GitCommitForm';
import { GitHistorySection } from '@/features/canvas/ui/git/GitHistorySection';
import {
  canOpenGitChangeInExplorer,
  isGitChangeAssetPath,
} from '@/features/canvas/ui/git/gitPathUtils';
import { canDiffGitChange } from '@/features/canvas/ui/git/gitDiffUtils';
import { formatGitStorageBytes } from '@/features/git/gitFormatters';
import type { ProjectGitChange } from '@/features/git/types';
import { useGitPluginStatus } from '@/features/git/useGitPluginStatus';
import { useProjectGitController } from '@/features/git/useProjectGitController';
import { navigateToProjectHomeTab } from '@/features/project/projectHomeNavigation';
import { useProjectStore } from '@/stores/projectStore';
import { UiButton, UiChipButton } from '@/components/ui/primitives';

interface ProjectVersionPanelProps {
  projectId: string;
  enabled: boolean;
  readOnly?: boolean;
  refreshSignal?: number;
}

interface DiffState {
  path: string;
  commit: string | null;
  changeKind: string;
}

export const ProjectVersionPanel = memo(({
  projectId,
  enabled,
  readOnly = false,
  refreshSignal = 0,
}: ProjectVersionPanelProps) => {
  const gitPluginStatus = useGitPluginStatus(enabled);
  const openProject = useProjectStore((state) => state.openProject);
  const {
    status,
    storage,
    changes,
    commits,
    error,
    dismissStorageWarning,
    setDismissStorageWarning,
    refreshAll,
    commit,
    resetLatest,
    checkout,
    revertChange,
  } = useProjectGitController({ projectId, enabled: enabled && Boolean(gitPluginStatus?.available) });

  const [commitMessage, setCommitMessage] = useState('更新项目');
  const [showCleanupHint, setShowCleanupHint] = useState(false);
  const [storageExpanded, setStorageExpanded] = useState(false);
  const [diffState, setDiffState] = useState<DiffState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const headCommit = status?.head;

  const runAction = useCallback(async (key: string, action: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await action();
    } catch (actionError) {
      window.alert(actionError instanceof Error ? actionError.message : '操作失败');
    } finally {
      setBusyAction(null);
    }
  }, []);

  const handleCommit = useCallback(async () => {
    const message = commitMessage.trim();
    if (!message) {
      window.alert('请输入提交说明');
      return;
    }
    await runAction('commit', async () => {
      await commit(message);
    });
  }, [commit, commitMessage, runAction]);

  const handleCheckout = useCallback(async (commitHash: string) => {
    const confirmed = window.confirm(
      '将用该版本覆盖当前项目文件（含 project.json 与 assets），未提交改动会丢失。是否继续？'
    );
    if (!confirmed) {
      return;
    }
    await runAction(`checkout-${commitHash}`, async () => {
      await checkout(commitHash);
      openProject(projectId);
    });
  }, [checkout, openProject, projectId, runAction]);

  const handleResetLatest = useCallback(async () => {
    const confirmed = window.confirm('将删除最新版本并回退到上一版，此操作不可撤销。是否继续？');
    if (!confirmed) {
      return;
    }
    await runAction('reset-latest', async () => {
      await resetLatest();
      openProject(projectId);
    });
  }, [openProject, projectId, resetLatest, runAction]);

  const canOpenChange = useCallback((change: ProjectGitChange) => {
    if (isGitChangeAssetPath(change.path)) {
      return true;
    }
    if (change.path === 'project.json' && headCommit) {
      return true;
    }
    return canOpenGitChangeInExplorer(change.path);
  }, [headCommit]);

  const handleOpenChange = useCallback((change: ProjectGitChange) => {
    if (isGitChangeAssetPath(change.path)) {
      revealProjectAsset(change.path);
      return;
    }
    if (change.path === 'project.json' && headCommit) {
      setDiffState({ path: change.path, commit: headCommit, changeKind: change.kind });
    }
  }, [headCommit]);

  const handleDiffChange = useCallback((change: ProjectGitChange) => {
    if (!canDiffGitChange(change, headCommit)) {
      return;
    }
    setDiffState({
      path: change.path,
      commit: headCommit ?? null,
      changeKind: change.kind,
    });
  }, [headCommit]);

  const handleRevertChange = useCallback((change: ProjectGitChange) => {
    void runAction(`revert-${change.path}`, () => revertChange(change.path, change.kind));
  }, [revertChange, runAction]);

  const busy = Boolean(busyAction);

  useEffect(() => {
    if (refreshSignal <= 0) {
      return;
    }
    void refreshAll({ force: true });
  }, [refreshSignal, refreshAll]);

  if (!gitPluginStatus?.available) {
    return (
      <div className="flex flex-col items-center gap-3 px-3 py-8 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <p className="text-xs leading-5 text-text-muted">
          Git 未安装或未在 PATH 中，无法使用版本控制。请前往
          {' '}
          <span className="text-text-dark">项目管理 → 插件列表</span>
          {' '}
          查看安装说明。
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
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-3 px-1 pb-2">
      {storage ? (
        <div className="rounded-md border border-border-dark/80 bg-bg-dark/30 px-2 py-1.5 text-[11px] text-text-muted">
          <button
            type="button"
            className="flex w-full items-start gap-1.5 text-left"
            onClick={() => setStorageExpanded((value) => !value)}
          >
            {storageExpanded ? (
              <ChevronDown className="mt-0.5 h-3 w-3 shrink-0" />
            ) : (
              <ChevronRight className="mt-0.5 h-3 w-3 shrink-0" />
            )}
            <span className="min-w-0 flex-1 text-text-dark">
              占用 {formatGitStorageBytes(storage.totalBytes)}
            </span>
          </button>
          {storageExpanded ? (
            <div className="mt-1 pl-8 leading-5">
              <div>工作区 {formatGitStorageBytes(storage.worktreeBytes)}</div>
              <div>Git 历史 {formatGitStorageBytes(storage.gitBytes)}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {storage?.exceedsOneGb && !dismissStorageWarning ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          <div className="font-medium">项目已超过 1 GB</div>
          <p className="mt-1 leading-5 text-amber-100/90">
            大体积多来自 assets 与 Git 历史中的重复快照。建议删除无用的旧版本 commit，历史仅保留一个版本即可。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <UiChipButton
              className="h-7 px-2 text-[11px]"
              onClick={() => setShowCleanupHint((value) => !value)}
            >
              了解如何清理
            </UiChipButton>
            <UiChipButton
              className="h-7 px-2 text-[11px]"
              onClick={() => setDismissStorageWarning(true)}
            >
              不再提醒
            </UiChipButton>
          </div>
          {showCleanupHint ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-100/85">
              <li>在下方历史列表中对最新版本使用「删除最新」，可逐步回退。</li>
              <li>建议仅保留当前工作区与至多 1 条历史 commit。</li>
              <li>清理前请先提交或确认未提交改动已不需要。</li>
            </ul>
          ) : null}
        </div>
      ) : null}

      <GitCommitForm
        message={commitMessage}
        readOnly={readOnly}
        busy={busy}
        onMessageChange={setCommitMessage}
        onCommit={() => void handleCommit()}
      />

      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      ) : null}

      <GitChangesSection
        changes={changes}
        readOnly={readOnly}
        busy={busy}
        headCommit={headCommit}
        canOpenChange={canOpenChange}
        onOpen={handleOpenChange}
        onDiff={handleDiffChange}
        onRevert={handleRevertChange}
      />

      <GitHistorySection
        commits={commits}
        headHash={headCommit}
        readOnly={readOnly}
        busy={busy}
        onCheckout={(hash) => void handleCheckout(hash)}
        onResetLatest={() => void handleResetLatest()}
      />

      {diffState ? (
        <SimpleAssetDiffDialog
          projectId={projectId}
          path={diffState.path}
          commit={diffState.commit}
          changeKind={diffState.changeKind}
          open
          onClose={() => setDiffState(null)}
        />
      ) : null}
    </div>
  );
});

ProjectVersionPanel.displayName = 'ProjectVersionPanel';
