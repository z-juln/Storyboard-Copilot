import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Viewport } from '@xyflow/react';
import {
  useCanvasStore,
  type CanvasEdge,
  type CanvasHistoryState,
  type CanvasNode,
} from './canvasStore';
import {
  deleteProjectRecord,
  getProjectSnapshot,
  listProjectSummaries,
  renameProjectRecord,
  updateProjectViewportRecord,
  upsertProjectSnapshot,
  type ProjectSummaryRecord,
} from '@/commands/projectState';
import {
  loadComponentDocProject,
  seedComponentDocBundle,
  isComponentDocEnabled,
  isComponentDocProjectId,
  mergeComponentDocProjectSummaries,
} from '@/features/canvas/component-doc';
import {
  createEmptyHistory,
  DEFAULT_VIEWPORT,
  projectToSnapshot,
  snapshotToProject,
  type Project,
  type ProjectSummary,
} from '@/features/project';
import {
  createEmptyAssetManifest,
  reconcileProjectAssets,
  registerPreparedAssetPaths,
  syncNodeAssetPathsFromManifest,
  type AssetManifest,
} from '@/features/project/asset';

export type { Project, ProjectSummary } from '@/features/project';

let openProjectRequestSeq = 0;
const UPSERT_DEBOUNCE_MS = 260;
const VIEWPORT_UPSERT_DEBOUNCE_MS = 280;
const VIEWPORT_EPSILON = 0.001;
const IDLE_PERSIST_TIMEOUT_MS = 1200;
const FALLBACK_IDLE_DELAY_MS = 64;
const DELETE_RETRY_DELAY_MS = 80;
const MAX_DELETE_RETRIES = 10;

const queuedProjectUpserts = new Map<string, Project>();
const projectUpsertTimers = new Map<string, ReturnType<typeof setTimeout>>();
const projectUpsertsInFlight = new Set<string>();
const queuedViewportUpserts = new Map<string, Viewport>();
const viewportUpsertTimers = new Map<string, ReturnType<typeof setTimeout>>();
const viewportUpsertsInFlight = new Set<string>();
const deletingProjectIds = new Set<string>();

function toProjectSummary(record: ProjectSummaryRecord): ProjectSummary {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    nodeCount: record.nodeCount,
  };
}

interface PersistProjectOptions {
  immediate?: boolean;
  debounceMs?: number;
}

interface PersistViewportOptions {
  immediate?: boolean;
  debounceMs?: number;
}

function scheduleIdlePersist(task: () => void): void {
  const idleHost = globalThis as typeof globalThis & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };

  if (typeof idleHost.requestIdleCallback === 'function') {
    idleHost.requestIdleCallback(task, { timeout: IDLE_PERSIST_TIMEOUT_MS });
    return;
  }

  setTimeout(task, FALLBACK_IDLE_DELAY_MS);
}

function hasViewportMeaningfulDelta(current: Viewport, next: Viewport): boolean {
  return (
    Math.abs(current.x - next.x) > VIEWPORT_EPSILON ||
    Math.abs(current.y - next.y) > VIEWPORT_EPSILON ||
    Math.abs(current.zoom - next.zoom) > VIEWPORT_EPSILON
  );
}

function normalizeViewport(viewport: Viewport): Viewport {
  return {
    x: Number(viewport.x.toFixed(2)),
    y: Number(viewport.y.toFixed(2)),
    zoom: Number(viewport.zoom.toFixed(4)),
  };
}

function clearQueuedProjectUpsert(projectId: string): void {
  const timer = projectUpsertTimers.get(projectId);
  if (timer) {
    clearTimeout(timer);
    projectUpsertTimers.delete(projectId);
  }
  queuedProjectUpserts.delete(projectId);
}

function clearQueuedViewportUpsert(projectId: string): void {
  const timer = viewportUpsertTimers.get(projectId);
  if (timer) {
    clearTimeout(timer);
    viewportUpsertTimers.delete(projectId);
  }
  queuedViewportUpserts.delete(projectId);
}

interface FlushProjectUpsertOptions {
  bypassIdle?: boolean;
}

function flushProjectUpsert(projectId: string, options?: FlushProjectUpsertOptions): void {
  if (deletingProjectIds.has(projectId) || projectUpsertsInFlight.has(projectId)) {
    return;
  }

  const project = queuedProjectUpserts.get(projectId);
  if (!project) {
    return;
  }

  queuedProjectUpserts.delete(projectId);
  projectUpsertsInFlight.add(projectId);

  const settle = () => {
    projectUpsertsInFlight.delete(projectId);

    if (deletingProjectIds.has(projectId)) {
      return;
    }

    if (queuedProjectUpserts.has(projectId)) {
      flushProjectUpsert(projectId);
    }
  };

  const executePersist = () => {
    if (deletingProjectIds.has(projectId)) {
      settle();
      return;
    }

    const snapshot = projectToSnapshot(project);
    void upsertProjectSnapshot(snapshot)
      .catch((error) => {
        console.error('Failed to persist project record', error);
      })
      .finally(settle);
  };

  if (options?.bypassIdle) {
    executePersist();
    return;
  }

  scheduleIdlePersist(executePersist);
}

function queueProjectUpsert(project: Project, options?: PersistProjectOptions): void {
  const projectId = project.id;
  deletingProjectIds.delete(projectId);
  queuedProjectUpserts.set(projectId, project);

  const existingTimer = projectUpsertTimers.get(projectId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    projectUpsertTimers.delete(projectId);
  }

  const debounceMs = options?.immediate ? 0 : (options?.debounceMs ?? UPSERT_DEBOUNCE_MS);
  if (debounceMs <= 0) {
    flushProjectUpsert(projectId, { bypassIdle: true });
    return;
  }

  const timer = setTimeout(() => {
    projectUpsertTimers.delete(projectId);
    flushProjectUpsert(projectId);
  }, debounceMs);
  projectUpsertTimers.set(projectId, timer);
}

function persistProject(project: Project, options?: PersistProjectOptions): void {
  if (isComponentDocProjectId(project.id)) {
    return;
  }
  clearQueuedViewportUpsert(project.id);
  queueProjectUpsert(project, options);
}

function flushViewportUpsert(projectId: string): void {
  if (deletingProjectIds.has(projectId) || viewportUpsertsInFlight.has(projectId)) {
    return;
  }

  const viewport = queuedViewportUpserts.get(projectId);
  if (!viewport) {
    return;
  }

  queuedViewportUpserts.delete(projectId);
  viewportUpsertsInFlight.add(projectId);

  void updateProjectViewportRecord(projectId, viewport)
    .catch((error) => {
      console.error('Failed to persist project viewport', error);
    })
    .finally(() => {
      viewportUpsertsInFlight.delete(projectId);

      if (deletingProjectIds.has(projectId)) {
        return;
      }

      if (queuedViewportUpserts.has(projectId)) {
        flushViewportUpsert(projectId);
      }
    });
}

function queueViewportUpsert(
  projectId: string,
  viewport: Viewport,
  options?: PersistViewportOptions
): void {
  if (isComponentDocProjectId(projectId)) {
    return;
  }
  deletingProjectIds.delete(projectId);
  queuedViewportUpserts.set(projectId, viewport);

  const existingTimer = viewportUpsertTimers.get(projectId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    viewportUpsertTimers.delete(projectId);
  }

  const debounceMs = options?.immediate ? 0 : (options?.debounceMs ?? VIEWPORT_UPSERT_DEBOUNCE_MS);
  if (debounceMs <= 0) {
    flushViewportUpsert(projectId);
    return;
  }

  const timer = setTimeout(() => {
    viewportUpsertTimers.delete(projectId);
    flushViewportUpsert(projectId);
  }, debounceMs);
  viewportUpsertTimers.set(projectId, timer);
}

function persistProjectDelete(projectId: string): void {
  deletingProjectIds.add(projectId);
  clearQueuedProjectUpsert(projectId);
  clearQueuedViewportUpsert(projectId);

  const attemptDelete = (retryCount: number): void => {
    if (projectUpsertsInFlight.has(projectId) || viewportUpsertsInFlight.has(projectId)) {
      if (retryCount >= MAX_DELETE_RETRIES) {
        deletingProjectIds.delete(projectId);
        return;
      }

      setTimeout(() => {
        attemptDelete(retryCount + 1);
      }, DELETE_RETRY_DELAY_MS);
      return;
    }

    void deleteProjectRecord(projectId)
      .catch((error) => {
        console.error('Failed to delete project record', error);
      })
      .finally(() => {
        deletingProjectIds.delete(projectId);
      });
  };

  attemptDelete(0);
}

function updateProjectSummary(
  summaries: ProjectSummary[],
  updated: ProjectSummary
): ProjectSummary[] {
  const next = summaries.map((summary) => (summary.id === updated.id ? updated : summary));
  next.sort((a, b) => b.updatedAt - a.updatedAt);
  return next;
}

interface ProjectState {
  projects: ProjectSummary[];
  currentProjectId: string | null;
  currentProject: Project | null;
  isHydrated: boolean;
  isOpeningProject: boolean;

  hydrate: () => Promise<void>;
  createProject: (name: string) => string;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  openProject: (id: string) => void;
  closeProject: () => void;
  getCurrentProject: () => Project | null;
  saveCurrentProject: (
    nodes: CanvasNode[],
    edges: CanvasEdge[],
    viewport?: Viewport,
    history?: CanvasHistoryState
  ) => void;
  saveCurrentProjectViewport: (viewport: Viewport) => void;
  cancelPendingViewportPersist: () => void;
  registerPreparedFileAssets: (
    imagePath: string,
    previewImagePath: string
  ) => { fileAssetId: string; previewFileAssetId: string } | null;
  commitAssetManifest: (manifest: AssetManifest) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  currentProject: null,
  isHydrated: false,
  isOpeningProject: false,

  hydrate: async () => {
    if (get().isHydrated) {
      return;
    }

    try {
      const records = await listProjectSummaries();
      const projects = records.map(toProjectSummary).sort((a, b) => b.updatedAt - a.updatedAt);
      set({
        projects: isComponentDocEnabled()
          ? mergeComponentDocProjectSummaries(projects)
          : projects,
        currentProjectId: null,
        currentProject: null,
        isHydrated: true,
      });
    } catch (error) {
      console.error('Failed to hydrate project summaries from SQLite', error);
      set({
        projects: isComponentDocEnabled() ? mergeComponentDocProjectSummaries([]) : [],
        currentProjectId: null,
        currentProject: null,
        isHydrated: true,
      });
    }
  },

  createProject: (name) => {
    const id = uuidv4();
    const now = Date.now();
    const project: Project = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      nodeCount: 0,
      nodes: [],
      edges: [],
      viewport: DEFAULT_VIEWPORT,
      history: createEmptyHistory(),
      assetManifest: createEmptyAssetManifest(),
    };

    set((state) => ({
      projects: [{ ...project }, ...state.projects],
      currentProjectId: id,
      currentProject: project,
      isOpeningProject: false,
    }));
    persistProject(project, { immediate: true });
    return id;
  },

  deleteProject: (id) => {
    if (isComponentDocProjectId(id)) {
      return;
    }
    set((state) => ({
      projects: state.projects.filter((project) => project.id !== id),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
      isOpeningProject: false,
    }));

    persistProjectDelete(id);
  },

  renameProject: (id, name) => {
    if (isComponentDocProjectId(id)) {
      return;
    }
    const now = Date.now();

    set((state) => {
      const projects = state.projects.map((summary) =>
        summary.id === id
          ? {
              ...summary,
              name,
              updatedAt: now,
            }
          : summary
      );

      return {
        projects: projects.sort((a, b) => b.updatedAt - a.updatedAt),
        currentProject:
          state.currentProject?.id === id
            ? {
                ...state.currentProject,
                name,
                updatedAt: now,
              }
            : state.currentProject,
      };
    });

    const nextCurrentProject = get().currentProject?.id === id ? get().currentProject : null;
    if (nextCurrentProject) {
      persistProject(nextCurrentProject, { immediate: true });
      return;
    }

    void renameProjectRecord(id, name, now).catch((error) => {
      console.error('Failed to rename project record', error);
    });
  },

  openProject: (id) => {
    const reqSeq = ++openProjectRequestSeq;
    useCanvasStore.getState().closeImageViewer();

    if (isComponentDocProjectId(id)) {
      set({ isOpeningProject: true });
      void (async () => {
        try {
          await seedComponentDocBundle();
          if (reqSeq !== openProjectRequestSeq) {
            return;
          }
          const project = loadComponentDocProject();
          set({
            currentProjectId: id,
            currentProject: project,
            isOpeningProject: false,
            projects: mergeComponentDocProjectSummaries(get().projects),
          });
        } catch (error) {
          if (reqSeq !== openProjectRequestSeq) {
            return;
          }
          console.error('Failed to open component doc project', error);
          set({ isOpeningProject: false });
        }
      })();
      return;
    }

    set({ isOpeningProject: true });

    void (async () => {
      try {
        const snapshot = await getProjectSnapshot(id);
        if (reqSeq !== openProjectRequestSeq) {
          return;
        }
        if (!snapshot) {
          set({ isOpeningProject: false });
          return;
        }

        const baseProject = snapshotToProject(snapshot);
        const reconciled = await reconcileProjectAssets({
          projectId: id,
          nodes: baseProject.nodes,
          assetManifest: baseProject.assetManifest,
        });

        const project: Project = {
          ...baseProject,
          nodes: reconciled.nodes,
          assetManifest: reconciled.assetManifest,
          nodeCount: reconciled.nodes.length,
        };

        set((state) => ({
          currentProjectId: id,
          currentProject: project,
          isOpeningProject: false,
          projects: updateProjectSummary(state.projects, {
            id: project.id,
            name: project.name,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            nodeCount: project.nodeCount,
          }),
        }));

        if (reconciled.dirty) {
          persistProject(project, { immediate: true });
        }
      } catch (error) {
        if (reqSeq !== openProjectRequestSeq) {
          return;
        }
        console.error('Failed to open project', error);
        set({ isOpeningProject: false });
      }
    })();
  },

  closeProject: () => {
    openProjectRequestSeq += 1;
    useCanvasStore.getState().closeImageViewer();
    const { currentProjectId, currentProject } = get();
    let persistedSummary: ProjectSummary | null = null;

    if (currentProjectId && currentProject && currentProject.id === currentProjectId) {
      if (!isComponentDocProjectId(currentProjectId)) {
        const canvasState = useCanvasStore.getState();
        const nextProject: Project = {
          ...currentProject,
          nodes: canvasState.nodes,
          edges: canvasState.edges,
          viewport: canvasState.currentViewport ?? currentProject.viewport ?? DEFAULT_VIEWPORT,
          history: canvasState.history ?? currentProject.history ?? createEmptyHistory(),
          nodeCount: canvasState.nodes.length,
          updatedAt: Date.now(),
        };

        persistedSummary = {
          id: nextProject.id,
          name: nextProject.name,
          createdAt: nextProject.createdAt,
          updatedAt: nextProject.updatedAt,
          nodeCount: nextProject.nodeCount,
        };
        persistProject(nextProject, { immediate: true });
      }
    }

    set((state) => ({
      projects: persistedSummary
        ? updateProjectSummary(state.projects, persistedSummary)
        : state.projects,
      currentProjectId: null,
      currentProject: null,
      isOpeningProject: false,
    }));
  },

  getCurrentProject: () => {
    const { currentProjectId, currentProject } = get();
    if (!currentProjectId || !currentProject) {
      return null;
    }
    if (currentProject.id !== currentProjectId) {
      return null;
    }
    return currentProject;
  },

  saveCurrentProject: (nodes, edges, viewport, history) => {
    const { currentProjectId, currentProject } = get();
    if (!currentProjectId || !currentProject || currentProject.id !== currentProjectId) {
      return;
    }

    const nextViewport = viewport ?? currentProject.viewport ?? DEFAULT_VIEWPORT;
    const nextHistory = history ?? currentProject.history ?? createEmptyHistory();
    const nextNodeCount = nodes.length;

    const hasViewportChanged =
      currentProject.viewport.x !== nextViewport.x ||
      currentProject.viewport.y !== nextViewport.y ||
      currentProject.viewport.zoom !== nextViewport.zoom;
    const hasChanged =
      currentProject.nodes !== nodes ||
      currentProject.edges !== edges ||
      currentProject.history !== nextHistory ||
      currentProject.nodeCount !== nextNodeCount ||
      hasViewportChanged;
    if (!hasChanged) {
      return;
    }

    const nextProject: Project = {
      ...currentProject,
      nodes,
      edges,
      viewport: nextViewport,
      history: nextHistory,
      nodeCount: nextNodeCount,
      updatedAt: Date.now(),
    };

    set((state) => ({
      currentProject: nextProject,
      projects: updateProjectSummary(state.projects, {
        id: nextProject.id,
        name: nextProject.name,
        createdAt: nextProject.createdAt,
        updatedAt: nextProject.updatedAt,
        nodeCount: nextProject.nodeCount,
      }),
    }));
    persistProject(nextProject);
  },

  saveCurrentProjectViewport: (viewport) => {
    const { currentProjectId, currentProject } = get();
    if (!currentProjectId || !currentProject || currentProject.id !== currentProjectId) {
      return;
    }
    if (isComponentDocProjectId(currentProjectId)) {
      set({
        currentProject: {
          ...currentProject,
          viewport: normalizeViewport(viewport),
        },
      });
      return;
    }

    const nextViewport = normalizeViewport(viewport);
    const hasChanged = hasViewportMeaningfulDelta(currentProject.viewport, nextViewport);
    if (!hasChanged) {
      return;
    }

    const nextProject: Project = {
      ...currentProject,
      viewport: nextViewport,
    };

    set({ currentProject: nextProject });
    queueViewportUpsert(currentProjectId, nextViewport);
  },

  cancelPendingViewportPersist: () => {
    const currentProjectId = get().currentProjectId;
    if (!currentProjectId) {
      return;
    }
    clearQueuedViewportUpsert(currentProjectId);
  },

  registerPreparedFileAssets: (imagePath, previewImagePath) => {
    const { currentProjectId, currentProject } = get();
    if (!currentProjectId || !currentProject || currentProject.id !== currentProjectId) {
      return null;
    }

    const registered = registerPreparedAssetPaths(
      currentProject.assetManifest ?? createEmptyAssetManifest(),
      imagePath,
      previewImagePath
    );
    const nextProject: Project = {
      ...currentProject,
      assetManifest: registered.manifest,
      updatedAt: Date.now(),
    };

    set({ currentProject: nextProject });
    persistProject(nextProject);
    return {
      fileAssetId: registered.fileAssetId,
      previewFileAssetId: registered.previewFileAssetId,
    };
  },

  commitAssetManifest: (manifest) => {
    const { currentProjectId, currentProject } = get();
    if (!currentProjectId || !currentProject || currentProject.id !== currentProjectId) {
      return;
    }
    if (isComponentDocProjectId(currentProjectId)) {
      return;
    }

    const canvasState = useCanvasStore.getState();
    const syncedNodes = syncNodeAssetPathsFromManifest(canvasState.nodes, manifest);
    if (syncedNodes !== canvasState.nodes) {
      useCanvasStore.setState({ nodes: syncedNodes });
    }

    const nextProject: Project = {
      ...currentProject,
      assetManifest: manifest,
      nodes: syncedNodes,
      edges: canvasState.edges,
      updatedAt: Date.now(),
    };
    set({ currentProject: nextProject });
    persistProject(nextProject);
  },
}));
