import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const SCRIPTS = path.join(__dirname, '..');

const summary = JSON.stringify({
    total: {
        lines: { pct: 80 },
        branches: { pct: 80 },
        functions: { pct: 80 },
        statements: { pct: 80 },
    },
});

function run(script: string, args: string[], cwd: string) {
    try {
        const stdout = execFileSync(process.execPath, [script, ...args], {
            cwd,
            encoding: 'utf8',
            stdio: 'pipe',
        });
        return { status: 0, stdout, stderr: '' };
    } catch (error) {
        const { status, stdout, stderr } = error as {
            status: number;
            stdout: string;
            stderr: string;
        };
        return { status, stdout, stderr };
    }
}

/**
 * The scripts as `.github/workflows/ci.yml` lays them out: the job checks out the base branch over
 * the PR, so it copies the PR's script to the temp directory first and runs it from there.
 */
describe('CI layout', () => {
    let root: string;
    let checkout: string;
    let tmp: string;

    beforeEach(() => {
        root = mkdtempSync(path.join(tmpdir(), 'ci-layout-'));
        checkout = path.join(root, 'checkout');
        tmp = path.join(root, 'tmp');
        mkdirSync(path.join(checkout, 'coverage'), { recursive: true });
        mkdirSync(path.join(tmp, 'pr'), { recursive: true });
        writeFileSync(path.join(tmp, 'pr', 'coverage-summary.json'), summary);
        writeFileSync(path.join(checkout, 'coverage', 'coverage-summary.json'), summary);
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    // ci.yml: `cp scripts/ci/coverage-report.mjs /tmp/coverage-report.mjs`, then
    // `node /tmp/coverage-report.mjs --pr /tmp/pr/coverage-summary.json --base coverage/...`.
    // The script now imports `../safe-path.mjs`, which that copy does not bring along.
    // Expected failure until ci.yml copies `scripts/` wholesale, as the bundle-size job does.
    it.fails('runs the coverage report copied on its own to the temp directory', () => {
        const script = path.join(tmp, 'coverage-report.mjs');
        copyFileSync(path.join(SCRIPTS, 'ci', 'coverage-report.mjs'), script);

        const { status, stdout, stderr } = run(
            script,
            [
                '--pr',
                path.join(tmp, 'pr', 'coverage-summary.json'),
                '--base',
                'coverage/coverage-summary.json',
                '--sha',
                'abc1234',
                '--base-ref',
                'main',
            ],
            checkout,
        );

        expect(stderr).toBe('');
        expect(status).toBe(0);
        expect(stdout).toContain('<!-- coverage-report -->');
    });

    // ci.yml: `cp -r scripts /tmp/ci-scripts`, then `node /tmp/ci-scripts/ci/bundle-size-report.mjs`.
    it('runs the bundle size report from the copied scripts directory', () => {
        cpSync(SCRIPTS, path.join(tmp, 'ci-scripts'), { recursive: true });
        const sizes = JSON.stringify({ entries: {}, chunks: {}, total: 0 });
        writeFileSync(path.join(tmp, 'pr', 'bundle-sizes.json'), sizes);
        writeFileSync(path.join(tmp, 'base-bundle.json'), sizes);

        const { status, stderr } = run(
            path.join(tmp, 'ci-scripts', 'ci', 'bundle-size-report.mjs'),
            [
                '--pr',
                path.join(tmp, 'pr', 'bundle-sizes.json'),
                '--base',
                path.join(tmp, 'base-bundle.json'),
                '--sha',
                'abc1234',
                '--base-ref',
                'main',
            ],
            checkout,
        );

        expect(stderr).not.toContain('Path traversal detected');
        expect(stderr).not.toContain('ERR_MODULE_NOT_FOUND');
        expect(status).toBe(0);
    });

    // ci.yml: `node scripts/ci/translations-report.mjs --translations-dir src/translations`.
    it('runs the translations report with the argument CI passes', () => {
        const { status, stderr } = run(
            path.join(SCRIPTS, 'ci', 'translations-report.mjs'),
            ['--translations-dir', 'src/translations', '--sha', 'abc1234'],
            path.join(SCRIPTS, '..'),
        );

        expect(stderr).toBe('');
        expect(status).toBe(0);
    });
});
