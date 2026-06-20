import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildComponentDocProject } from '../src/features/canvas/component-doc/buildComponentDocProject.ts';
import { projectToSnapshot } from '../src/features/project/projectCodec.ts';

const snapshot = projectToSnapshot(buildComponentDocProject());
const target = join(import.meta.dirname, '../src/features/canvas/component-doc/project.json');
writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${target} (${snapshot.nodeCount} nodes)`);
