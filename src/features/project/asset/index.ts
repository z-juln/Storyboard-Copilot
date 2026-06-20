export type {
  AssetManifest,
  AssetRef,
  FileAssetRecord,
  PreparedFileAssetRefs,
} from './types';
export {
  createEmptyAssetManifest,
  findFileAssetIdByPath,
  normalizeAssetPath,
  registerFileAssetPath,
  removeFileAsset,
  remapManifestPathPrefix,
  removeManifestPaths,
  resolveManifestPath,
  isProjectAssetAvailable,
  updateFileAssetPath,
} from './assetManifest';
export {
  applyFileAssetIdToNodes,
  countRefsForFileAssetId,
  listAssetRefs,
  scanNodeAssetPathFields,
  stripLegacyPreviewFieldsFromNodes,
  syncNodeAssetPathsFromManifest,
} from './assetRefIndex';
export {
  listProjectAssetFilePaths,
  reconcileProjectAssets,
  registerPreparedAssetPath,
  type ReconcileProjectAssetsResult,
  pruneManifestToAvailableDiskPaths,
} from './reconcileProjectAssets';
export { resolveFileAssetDisplayUrl } from './resolveAssetDisplayUrl';
export { PROJECT_ASSET_UNAVAILABLE_MESSAGE } from './assetUnavailableMessage';
export {
  useIsProjectAssetUnavailable,
  useProjectAssetAvailability,
  type ProjectAssetBinding,
} from './useProjectAssetAvailability';
export {
  collectFilePathsFromEntry,
  filterTreeByQuery,
  findEntryByPath,
  findEntryInTree,
  getAssetBaseName,
  getAssetParentPath,
  getSiblingEntries,
  isDescendantAssetPath,
  joinAssetPath,
} from './assetExplorerPathUtils';
export type { AssetSelectionItem } from './assetExplorerSelection';
export {
  entriesToSelectionItems,
  filterTopLevelSelectedPaths,
  resolveEntriesForPaths,
  resolveTopLevelSelectedEntries,
} from './assetExplorerSelection';
export {
  clearSystemClipboardCutMarker,
  hasSystemClipboardAssetItems,
  readProjectAssetsFromSystemClipboard,
  writeProjectAssetsToSystemClipboard,
  type AssetClipboardMode,
  type AssetClipboardPasteItem,
  type AssetClipboardPastePayload,
} from './assetExplorerClipboard';
export {
  countAssetPathRefs,
  copyProjectAssetEntry,
  createProjectAssetFile,
  createProjectAssetFolder,
  deleteProjectAssetEntry,
  deleteProjectAssetEntries,
  importExternalFilesToDirectory,
  importExternalPathsToDirectory,
  moveProjectAssetEntry,
  moveProjectAssetEntries,
  pasteSystemClipboardToDirectory,
  renameProjectAssetEntry,
  resolveNewSiblingName,
} from './projectAssetService';
export {
  fetchAssetTextContent,
  isAssetPreviewable,
  isBindableTextAssetFileName,
  isMarkdownTextAssetFileName,
  resolveAssetPreviewKind,
  type AssetPreviewKind,
} from './assetPreviewUtils';
export {
  loadProjectAssetTextContent,
  saveProjectAssetTextContent,
} from './textAssetContent';
