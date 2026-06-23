export interface GitPluginStatus {
  available: boolean;
  version: string | null;
  installHint: string;
}

export interface ProjectGitStorage {
  totalBytes: number;
  worktreeBytes: number;
  gitBytes: number;
  updatedAt: number;
  exceedsOneGb: boolean;
}

export interface ProjectGitStatus {
  initialized: boolean;
  branch: string | null;
  head: string | null;
  dirty: boolean;
  commitCount: number;
}

export type ProjectGitChangeKind = 'added' | 'modified' | 'deleted' | 'renamed';

export interface ProjectGitChange {
  path: string;
  kind: ProjectGitChangeKind | string;
  oldPath?: string | null;
}

export interface ProjectGitCommit {
  hash: string;
  shortHash: string;
  message: string;
  committedAt: string;
}

export interface ProjectGitBlob {
  kind: 'text' | 'binary' | 'missing' | string;
  text?: string | null;
  base64?: string | null;
  size: number;
}
