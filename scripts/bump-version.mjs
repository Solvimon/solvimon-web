import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

const releaseTypes = ['patch', 'minor', 'major'];
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
    const arg = process.argv[2];

    if (isReleaseType(arg)) {
        bumpVersion(arg);
        return;
    }

    const rl = createInterface({ input, output });

    try {
        output.write('Select SDK version bump:\n');
        output.write('1. patch\n');
        output.write('2. minor\n');
        output.write('3. major\n');

        const answer = (await rl.question('Choice [1-3, patch/minor/major]: ')).trim().toLowerCase();
        const releaseType = parseReleaseType(answer);

        if (!releaseType) {
            output.write('Invalid choice. Use 1, 2, 3, patch, minor, or major.\n');
            process.exitCode = 1;
            return;
        }

        bumpVersion(releaseType);
    } finally {
        rl.close();
    }
}

function bumpVersion(releaseType) {
    execFileSync('npm', ['version', releaseType, '--no-git-tag-version'], {
        cwd: packageDir,
        stdio: 'inherit',
    });
}

function isReleaseType(value) {
    return releaseTypes.includes(value);
}

function parseReleaseType(value) {
    if (isReleaseType(value)) {
        return value;
    }

    if (value === '1') {
        return 'patch';
    }

    if (value === '2') {
        return 'minor';
    }

    if (value === '3') {
        return 'major';
    }

    return null;
}

await main();
