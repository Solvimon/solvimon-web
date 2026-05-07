import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function checkChangelog(version, changelog, { tagName } = {}) {
    if (tagName?.startsWith('v')) {
        const tagVersion = tagName.slice(1);
        if (tagVersion !== version) {
            return {
                ok: false,
                error: `Release tag ${tagName} does not match package.json version ${version}.`,
            };
        }
    }

    const headingPattern = new RegExp(`^##\\s+\\[?v?${escapeRegExp(version)}\\]?\\b.*$`, 'm');
    const headingMatch = changelog.match(headingPattern);

    if (!headingMatch) {
        return {
            ok: false,
            error: `CHANGELOG.md must contain a "## ${version}" section before publishing.`,
        };
    }

    const sectionStart = headingMatch.index + headingMatch[0].length;
    const nextHeadingIndex = changelog.slice(sectionStart).search(/^##\s+/m);
    const sectionBody =
        nextHeadingIndex === -1
            ? changelog.slice(sectionStart)
            : changelog.slice(sectionStart, sectionStart + nextHeadingIndex);

    if (!sectionBody.trim()) {
        return {
            ok: false,
            error: `CHANGELOG.md section for ${version} must describe the release changes.`,
        };
    }

    return { ok: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
    const changelog = readFileSync(resolve(rootDir, 'CHANGELOG.md'), 'utf8');

    const result = checkChangelog(packageJson.version, changelog, {
        tagName: process.env.GITHUB_REF_NAME,
    });

    if (!result.ok) {
        console.error(result.error);
        process.exit(1);
    }
}
