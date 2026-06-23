export function formatGitStorageBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

export function formatGitChangeKind(kind: string): string {
  switch (kind) {
    case 'added':
      return '新增';
    case 'modified':
      return '修改';
    case 'deleted':
      return '删除';
    case 'renamed':
      return '移动';
    default:
      return kind;
  }
}

export function gitChangeKindClassName(kind: string): string {
  switch (kind) {
    case 'added':
      return 'text-emerald-300';
    case 'modified':
      return 'text-sky-300';
    case 'deleted':
      return 'text-rose-300';
    case 'renamed':
      return 'text-violet-300';
    default:
      return 'text-text-muted';
  }
}

export function gitChangeStatusLetter(kind: string): string {
  switch (kind) {
    case 'added':
      return 'U';
    case 'modified':
      return 'M';
    case 'deleted':
      return 'D';
    case 'renamed':
      return 'R';
    default:
      return '?';
  }
}

export function gitChangeStatusClassName(kind: string): string {
  switch (kind) {
    case 'added':
      return 'text-sky-400';
    case 'modified':
      return 'text-amber-400';
    case 'deleted':
      return 'text-rose-400';
    case 'renamed':
      return 'text-violet-400';
    default:
      return 'text-text-muted';
  }
}

export function formatCommitTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
