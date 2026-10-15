import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { dependencyClosure, ownDiagnostics } from './check-consumer-types.mjs';

const dirs: string[] = [];

afterEach(() => {
    dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
    dirs.length = 0;
});

function nodeModules(packages: Record<string, Record<string, string>>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'consumer-types-'));
    dirs.push(dir);
    for (const [name, dependencies] of Object.entries(packages)) {
        fs.mkdirSync(path.join(dir, name), { recursive: true });
        fs.writeFileSync(
            path.join(dir, name, 'package.json'),
            JSON.stringify({ name, dependencies }),
        );
    }
    return dir;
}

describe('dependencyClosure', () => {
    it('follows dependencies transitively, each package once', () => {
        const dir = nodeModules({
            vue: { '@vue/runtime-dom': '3', '@vue/shared': '3' },
            '@vue/runtime-dom': { '@vue/shared': '3', csstype: '3' },
            '@vue/shared': {},
            csstype: {},
            unrelated: {},
        });

        expect(dependencyClosure(['vue'], dir)).toEqual([
            '@vue/runtime-dom',
            '@vue/shared',
            'csstype',
            'vue',
        ]);
    });

    it('skips a dependency that is not installed', () => {
        const dir = nodeModules({ vue: { 'optional-thing': '1' } });

        expect(dependencyClosure(['vue'], dir)).toEqual(['vue']);
    });
});

describe('ownDiagnostics', () => {
    it('keeps errors in the fixture and in the SDK, with their continuation lines', () => {
        const output = [
            "consumer.ts(3,5): error TS2322: Type 'number' is not assignable to type 'string'.",
            "node_modules/@solvimon/solvimon-web/dist/types/a.d.ts(1,1): error TS2307: Cannot find module 'x'.",
            '  Did you mean to set moduleResolution?',
        ].join('\n');

        expect(ownDiagnostics(output)).toBe(output);
    });

    it('drops errors inside third-party declarations', () => {
        const output = [
            "node_modules/some-library/index.d.ts(5,108): error TS2307: Cannot find module 'its-undeclared-dependency'.",
            "consumer.ts(3,5): error TS2322: Type 'number' is not assignable to type 'string'.",
        ].join('\n');

        expect(ownDiagnostics(output)).toBe(
            "consumer.ts(3,5): error TS2322: Type 'number' is not assignable to type 'string'.",
        );
    });
});
