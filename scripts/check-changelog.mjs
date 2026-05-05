import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
const changelog = readFileSync(resolve(rootDir, 'CHANGELOG.md'), 'utf8');

const version = packageJson.version;
const tagName = process.env.GITHUB_REF_NAME;

if (tagName?.startsWith('v')) {
    const tagVersion = tagName.slice(1);

    if (tagVersion !== version) {
        fail(`Release tag ${tagName} does not match package.json version ${version}.`);
    }
}

const escapedVersion = escapeRegExp(version);
const headingPattern = new RegExp(`^##\\s+\\[?v?${escapedVersion}\\]?\\b.*$`, 'm');
const headingMatch = changelog.match(headingPattern);

if (!headingMatch) {
    fail(`CHANGELOG.md must contain a "## ${version}" section before publishing.`);
}

const sectionStart = headingMatch.index + headingMatch[0].length;
const nextHeadingIndex = changelog.slice(sectionStart).search(/^##\s+/m);
const sectionBody =
    nextHeadingIndex === -1
        ? changelog.slice(sectionStart)
        : changelog.slice(sectionStart, sectionStart + nextHeadingIndex);

if (!sectionBody.trim()) {
    fail(`CHANGELOG.md section for ${version} must describe the release changes.`);
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fail(message) {
    console.error(message);
    process.exit(1);
}
