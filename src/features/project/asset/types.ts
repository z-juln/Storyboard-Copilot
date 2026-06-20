/** `assets/` 下单个文件的注册信息；键为 fileAssetId（非 nodeId）。 */
export interface FileAssetRecord {
  path: string;
  updatedAt: number;
  contentHash?: string;
}

export type AssetManifest = Record<string, FileAssetRecord>;

export interface PreparedFileAssetRefs {
  imageUrl: string;
  fileAssetId: string;
  aspectRatio: string;
  contentHash?: string;
}

export interface AssetRef {
  nodeId: string;
  field: string;
  fileAssetId: string;
}
