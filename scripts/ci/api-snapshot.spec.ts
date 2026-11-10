import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { changedSections, renderSnapshot } from './api-snapshot.mjs';

const dirs: string[] = [];

afterEach(() => {
    dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
    dirs.length = 0;
});

function tmpDist(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-snapshot-'));
    dirs.push(dir);
    return dir;
}

function write(dist: string, relPath: string, contents: string): void {
    const file = path.join(dist, relPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, 'utf-8');
}

describe('renderSnapshot', () => {
    it('holds every declaration reachable from an entry point, by path, and nothing else', () => {
        const dist = tmpDist();
        write(
            dist,
            'index.d.ts',
            "export type { B } from './types/b';\nexport type { A } from './types/a';\n",
        );
        write(dist, 'types/a.d.ts', 'export interface A { a: string; }\n');
        write(dist, 'types/b.d.ts', 'export interface B { b: number; }\n');
        write(dist, 'types/unreached.d.ts', 'export interface Unreached {}\n');

        const snapshot = renderSnapshot(dist);

        expect(snapshot.match(/^\/\/ \S+$/gm)).toEqual([
            '// index.d.ts',
            '// types/a.d.ts',
            '// types/b.d.ts',
        ]);
        expect(snapshot).not.toContain('Unreached');
    });

    it('leaves out what changes without the surface changing: source map links, trailing spaces', () => {
        const dist = tmpDist();
        write(
            dist,
            'index.d.ts',
            'export declare const a: string;   \n//# sourceMappingURL=index.d.ts.map\n',
        );

        expect(renderSnapshot(dist)).toBe('// index.d.ts\nexport declare const a: string;\n');
    });
});

describe('changedSections', () => {
    const snapshot = (sections: Record<string, string>) =>
        Object.entries(sections)
            .map(([file, source]) => `// ${file}\n${source}\n`)
            .join('\n');

    it('names each file that was added, removed or changed, and no other', () => {
        const before = snapshot({
            'index.d.ts': 'export {};',
            'types/kept.d.ts': 'export interface Kept {}',
            'types/gone.d.ts': 'export interface Gone {}',
            'types/edited.d.ts': 'export interface Edited { a: string }',
        });
        const after = snapshot({
            'index.d.ts': 'export {};',
            'types/kept.d.ts': 'export interface Kept {}',
            'types/edited.d.ts': 'export interface Edited { a?: string }',
            'types/new.d.ts': 'export interface New {}',
        });

        expect(changedSections(before, after)).toEqual([
            'changed: types/edited.d.ts',
            'removed: types/gone.d.ts',
            'added: types/new.d.ts',
        ]);
    });
});
