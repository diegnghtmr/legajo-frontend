import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SOURCE = join(process.cwd(), '..', 'backend', 'docs', 'openapi-legajo.yaml');
const DESTINATION = join(process.cwd(), 'contract', 'openapi-legajo.yaml');

function main(): void {
  if (!existsSync(SOURCE)) {
    console.error(
      `api:sync: sibling backend repo not found at ${SOURCE}.\n` +
        'Run this from the legajo-general workspace with backend/ checked out next to frontend/,' +
        ' or vendor contract/openapi-legajo.yaml manually.',
    );
    process.exit(1);
  }

  mkdirSync(dirname(DESTINATION), { recursive: true });
  copyFileSync(SOURCE, DESTINATION);
  console.log(`api:sync: copied ${SOURCE} -> ${DESTINATION}`);
}

main();
