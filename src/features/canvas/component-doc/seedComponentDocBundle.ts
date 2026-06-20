import sampleAssetUrl from './assets/sample.png?url';
import placeholderAssetUrl from './assets/placeholder.png?url';

import { rustApiClient } from '@/infrastructure/rustApiClient';
import { upsertProjectSnapshot } from '@/commands/projectState';

import { COMPONENT_DOC_PROJECT_ID } from './constants';
import { getComponentDocSnapshot } from './loadComponentDocProject';

const COMPONENT_DOC_ASSETS = [
  { fileName: 'sample.png', url: sampleAssetUrl },
  { fileName: 'placeholder.png', url: placeholderAssetUrl },
] as const;

/** 将仓库内 component-doc bundle 同步到 app_data/projects/component-doc/ */
export async function seedComponentDocBundle(): Promise<void> {
  await upsertProjectSnapshot(getComponentDocSnapshot());

  await Promise.all(
    COMPONENT_DOC_ASSETS.map(async ({ fileName, url }) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load component-doc asset: ${fileName}`);
      }
      const blob = await response.blob();
      await rustApiClient.putProjectAsset(COMPONENT_DOC_PROJECT_ID, fileName, blob);
    })
  );
}
