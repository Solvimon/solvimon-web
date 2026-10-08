import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `0.1.0` must not match `## [0.1.0-alpha.25]`, or a stable release passes on the strength of the
 * alpha section above it and ships with no notes of its own.
 */
function headingPattern(version) {
    return new RegExp(`^##\\s+\\[?v?${escapeRegExp(version)}\\]?(?![\\w.-]).*$`, 'm');
}

function sectionBodyOf(changelog, headingMatch) {
    const sectionStart = headingMatch.index + headingMatch[0].length;
    const nextHeadingIndex = changelog.slice(sectionStart).search(/^##\s+/m);

    return nextHeadingIndex === -1
        ? changelog.slice(sectionStart)
        : changelog.slice(sectionStart, sectionStart + nextHeadingIndex);
}

/**
 * The release notes for a version, read by the same rule that gates it. The workflow used to find
 * the section with an awk of its own that only matched `## [version]`, so a heading this accepted
 * without brackets released with an empty body.
 */
export function getChangelogSection(version, changelog) {
    const headingMatch = changelog.match(headingPattern(version));

    return headingMatch ? sectionBodyOf(changelog, headingMatch).trim() : '';
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

    const headingMatch = changelog.match(headingPattern(version));

    if (!headingMatch) {
        return {
            ok: false,
            error: `CHANGELOG.md must contain a "## ${version}" section before publishing.`,
        };
    }

    const sectionBody = sectionBodyOf(changelog, headingMatch);

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
