import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * `prerelease` is last so the numbers already in people's fingers keep their meaning: 1 is still
 * patch. It is nonetheless the one this package wants while the version carries an `-alpha` tag —
 * npm's `patch` and `minor` *strip* that tag, so `0.1.0-alpha.22` becomes `0.1.0` and the package
 * silently graduates out of alpha.
 */
const releaseTypes = ['patch', 'minor', 'major', 'prerelease'];

export function isReleaseType(value) {
    return releaseTypes.includes(value);
}

export function parseReleaseType(value) {
    if (isReleaseType(value)) return value;
    if (value === '1') return 'patch';
    if (value === '2') return 'minor';
    if (value === '3') return 'major';
    if (value === '4') return 'prerelease';
    return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

    function bumpVersion(releaseType) {
        execFileSync('npm', ['version', releaseType, '--no-git-tag-version'], {
            cwd: packageDir,
            stdio: 'inherit',
        });
    }

    const arg = process.argv[2];

    if (isReleaseType(arg)) {
        bumpVersion(arg);
    } else {
        const rl = createInterface({ input, output });

        try {
            output.write('Select SDK version bump:\n');
            output.write('1. patch\n');
            output.write('2. minor\n');
            output.write('3. major\n');
            output.write('4. prerelease\n');
            output.write(
                '\nOn an -alpha version, patch and minor drop the tag (0.1.0-alpha.22 -> 0.1.0).\n' +
                    'Pick prerelease to stay in alpha (-> 0.1.0-alpha.23).\n\n',
            );

            const answer = (await rl.question('Choice [1-4, patch/minor/major/prerelease]: '))
                .trim()
                .toLowerCase();
            const releaseType = parseReleaseType(answer);

            if (!releaseType) {
                output.write(
                    'Invalid choice. Use 1, 2, 3, 4, patch, minor, major, or prerelease.\n',
                );
                process.exitCode = 1;
            } else {
                bumpVersion(releaseType);
            }
        } finally {
            rl.close();
        }
    }
}
