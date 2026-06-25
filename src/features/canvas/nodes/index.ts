import type { NodeTypes } from '@xyflow/react';

import { ExternalTechNode } from './ExternalTechNode';
import { GroupNode } from './GroupNode';
import { ImageEditNode } from './ImageEditNode';
import { ImageNode } from './ImageNode';
import { StoryboardGenNode } from './StoryboardGenNode';
import { StoryboardNode } from './StoryboardNode';
import { TextAnnotationNode } from './TextAnnotationNode';
import { TextNode } from './TextNode';
import { UploadNode } from './UploadNode';
import { UploadVideoNode, UploadAudioNode } from './UploadMediaNode';

export const nodeTypes: NodeTypes = {
  exportImageNode: ImageNode,
  groupNode: GroupNode,
  imageNode: ImageEditNode,
  storyboardGenNode: StoryboardGenNode,
  storyboardNode: StoryboardNode,
  textAnnotationNode: TextAnnotationNode,
  textNode: TextNode,
  uploadNode: UploadNode,
  uploadVideoNode: UploadVideoNode,
  uploadAudioNode: UploadAudioNode,
  externalTechNode: ExternalTechNode,
};

export {
  ExternalTechNode,
  GroupNode,
  ImageEditNode,
  ImageNode,
  StoryboardGenNode,
  StoryboardNode,
  TextAnnotationNode,
  TextNode,
  UploadNode,
  UploadVideoNode,
  UploadAudioNode,
};
