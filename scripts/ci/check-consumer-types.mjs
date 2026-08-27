import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/**
 * What the fixture needs to compile, beyond the SDK itself. `vue` is a peer dependency every
 * consumer already has; the rest is what `vue`'s own declarations reach for.
 */
const CONSUMER_DEPENDENCIES = ['vue', '@vue', 'csstype', 'typescript'];

/**
 * Type-checks a fixture consumer against the packed tarball.
 *
 * The fixture is built outside the repository on purpose. Node resolves from the real path of a
 * file, so a fixture inside the repo — or symlinked into it — walks up into the repo's own
 * `node_modules` and finds `@solvimon/solvimon-types`, which no consumer can install. Checking
 * there would prove nothing: the published types would look resolvable when they are not.
 *
 * @param {{ keep?: boolean }} [options]
 * @returns {{ ok: boolean, output: string, dir: string }}
 */
export function checkConsumerTypes({ keep = false } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'solvimon-consumer-types-'));

    try {
        const packageDir = join(dir, 'node_modules', '@solvimon', 'solvimon-web');
        mkdirSync(packageDir, { recursive: true });

        // `npm pack` is what makes this a test of the published package rather than of `dist/`:
        // it applies `files` and `exports`, so anything left out of the tarball fails here.
        const tarball = execFileSync('npm', ['pack', '--silent', '--pack-destination', dir], {
            cwd: ROOT,
            encoding: 'utf-8',
        }).trim();

        execFileSync('tar', ['-xzf', join(dir, tarball), '-C', packageDir, '--strip-components=1']);

        for (const dependency of CONSUMER_DEPENDENCIES) {
            const from = join(ROOT, 'node_modules', dependency);
            if (existsSync(from)) {
                cpSync(from, join(dir, 'node_modules', dependency), {
                    recursive: true,
                    dereference: true,
                });
            }
        }

        for (const file of readdirSync(join(ROOT, 'tests/consumer-types'))) {
            cpSync(join(ROOT, 'tests/consumer-types', file), join(dir, file));
        }

        try {
            execFileSync(join(dir, 'node_modules/typescript/bin/tsc'), ['-p', 'tsconfig.json'], {
                cwd: dir,
                encoding: 'utf-8',
                stdio: 'pipe',
            });
        } catch (error) {
            return { ok: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}`.trim(), dir };
        }

        return { ok: true, output: '', dir };
    } finally {
        if (!keep) rmSync(dir, { recursive: true, force: true });
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { ok, output } = checkConsumerTypes();

    if (ok) {
        console.log('The published types check out for a consumer without the private packages.');
        process.exit(0);
    }

    console.error('A consumer of the published package does not get the types it should:\n');
    console.error(output);
    console.error(
        [
            '',
            'Every line in tests/consumer-types/consumer.ts without a `@ts-expect-error` has to',
            'compile, and every line with one has to fail. An "unused @ts-expect-error" means a',
            'mistake that used to be caught no longer is — usually because a declaration stopped',
            'resolving and quietly became `any`.',
        ].join('\n'),
    );
    process.exit(1);
}
