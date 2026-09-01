import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import {
    internalHosts,
    readInternalConfigs,
    findInBundle,
    walk,
} from './check-bundle-contents.mjs';

const dirs: string[] = [];

afterEach(() => {
    dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
    dirs.length = 0;
});

function tmpDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-contents-'));
    dirs.push(dir);
    return dir;
}

function write(dir: string, relPath: string, content: string): void {
    const file = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf-8');
}

describe('internalHosts', () => {
    it('pulls the host and port out of every URL a config names', () => {
        expect(
            internalHosts({
                'config.dev.ts': `identity: 'https://dev.solvimon.com:10016/v1',
                                  config: 'https://dev.solvimon.com:10010/v1',`,
            }).sort(),
        ).toStrictEqual(['dev.solvimon.com:10010', 'dev.solvimon.com:10016']);
    });

    it('skips template placeholders, which name no host of their own', () => {
        expect(
            internalHosts({ 'config.ci.ts': 'identity: `https://${TEST_APP_HOST}:${PORT}/x`' }),
        ).toStrictEqual([]);
    });

    it('returns nothing for a config with no URLs', () => {
        expect(internalHosts({ 'config.empty.ts': 'export const x = {};' })).toStrictEqual([]);
    });
});

describe('readInternalConfigs', () => {
    it('reads every config module except the public ones', () => {
        const dir = tmpDir();
        write(dir, 'config.live.ts', 'live');
        write(dir, 'config.test.ts', 'test');
        write(dir, 'config.dev.ts', 'dev');
        write(dir, 'config.beta.ts', 'beta');
        write(dir, 'lib.ts', 'not a config');

        expect(Object.keys(readInternalConfigs(dir)).sort()).toStrictEqual([
            'config.beta.ts',
            'config.dev.ts',
        ]);
    });
});

describe('findInBundle', () => {
    it('reports each needle with the files naming it', () => {
        const dist = tmpDir();
        write(dist, 'chunk.mjs', 'const a = "https://dev.solvimon.com:10016/v1";');
        write(dist, 'nested/other.js', 'const b = "https://dev.solvimon.com:10016/v1";');
        write(dist, 'clean.mjs', 'const c = "https://api.solvimon.com/v1";');

        const found = findInBundle(dist, ['dev.solvimon.com:10016']);

        expect(found).toHaveLength(1);
        expect(found[0].needle).toBe('dev.solvimon.com:10016');
        expect(found[0].files.sort()).toStrictEqual(['chunk.mjs', path.join('nested', 'other.js')]);
    });

    it('returns nothing when the bundle is clean', () => {
        const dist = tmpDir();
        write(dist, 'chunk.mjs', 'const a = "https://api.solvimon.com/v1";');

        expect(findInBundle(dist, ['dev.solvimon.com:10016'])).toStrictEqual([]);
    });

    it('does not flag a host that only resembles a forbidden one', () => {
        const dist = tmpDir();
        // Adyen ships this; it is not the test app's origin and must not trip the gate.
        write(dist, 'adyen.mjs', 'api.includes("http://localhost:8080")');

        expect(findInBundle(dist, ['localhost:5173'])).toStrictEqual([]);
    });

    it('checks nothing when there is nothing to look for', () => {
        expect(findInBundle(tmpDir(), [])).toStrictEqual([]);
    });
});

describe('walk', () => {
    it('finds files at every depth', () => {
        const dir = tmpDir();
        write(dir, 'a.mjs', '');
        write(dir, 'deep/b.mjs', '');
        write(dir, 'deep/deeper/c.mjs', '');

        expect(walk(dir)).toHaveLength(3);
    });
});
