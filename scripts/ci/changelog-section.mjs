import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getChangelogSection } from '../check-changelog.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const version = process.argv[2];

if (!version) {
    console.error('Usage: node scripts/ci/changelog-section.mjs <version>');
    process.exit(1);
}

const changelog = readFileSync(resolve(rootDir, 'CHANGELOG.md'), 'utf8');

process.stdout.write(getChangelogSection(version, changelog));
