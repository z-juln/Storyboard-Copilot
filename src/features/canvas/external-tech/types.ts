/** 外部科技 Provider 的端口类型。 */
export type ExternalTechPortKind = 'text' | 'image' | 'video' | 'any';

export type ExternalTechRunner = 'local-zimage' | 'webview-script';

export interface ExternalTechPortDefinition {
  id: string;
  kind: ExternalTechPortKind;
  label: string;
  required?: boolean;
}

export interface ExternalTechProviderDefinition {
  id: string;
  label: string;
  description?: string;
  embedUrl: string;
  runner: ExternalTechRunner;
  inputs: ExternalTechPortDefinition[];
  outputs: ExternalTechPortDefinition[];
  scriptId?: string;
  defaultPrompt?: string;
}

export interface ExternalTechRunInput {
  providerId: string;
  prompt: string;
  inputs: Record<string, string>;
  projectId?: string | null;
}

export interface ExternalTechRunResult {
  outputs: Record<string, string>;
}

export interface LocalZImageStatus {
  installed: boolean;
  install_running: boolean;
  install_phase: string;
  install_progress: number;
  install_error: string | null;
  python_path: string | null;
  venv_ready: boolean;
  server_running: boolean;
  server_url: string;
  log_tail: string[];
  completed_steps: string[];
  system_python_detected: boolean;
  next_recommended_step: string | null;
  needs_setup: boolean;
  detected_system_python: string | null;
  server_detached: boolean;
  model_loaded: boolean;
  model_loading: boolean;
  model_phase: string;
  model_progress: number;
  model_error: string | null;
}
