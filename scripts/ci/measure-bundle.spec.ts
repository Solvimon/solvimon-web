import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { dirSize, parseImports, measureEntryGraph, measureBundle } from './measure-bundle.mjs';

const dirs: string[] = [];

afterEach(() => {
    dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
    dirs.length = 0;
});

function tmpDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-bundle-'));
    dirs.push(dir);
    return dir;
}

/** Writes `content` padded to exactly `size` bytes so assertions can use round numbers. */
function writeChunk(dist: string, relPath: string, content = '', size = 0): string {
    const file = path.join(dist, relPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const padding = Math.max(0, size - Buffer.byteLength(content));
    fs.writeFileSync(file, content + '/*' + 'x'.repeat(Math.max(0, padding - 4)) + '*/', 'utf-8');
    return file;
}

describe('parseImports', () => {
    it('extracts static imports, bare imports and re-exports', () => {
        const { staticImports } = parseImports(
            'import{a}from"./a.mjs";import"./side.mjs";export*from"./b.mjs";',
        );
        expect(staticImports).toEqual(['./a.mjs', './side.mjs', './b.mjs']);
    });

    it('does not treat a dynamic import as static', () => {
        const { staticImports, dynamicImports } = parseImports(
            'const m=await import("./lazy.mjs")',
        );
        expect(staticImports).toEqual([]);
        expect(dynamicImports).toEqual(['./lazy.mjs']);
    });

    it('deduplicates repeated specifiers', () => {
        const { staticImports } = parseImports('import{a}from"./a.mjs";import{b}from"./a.mjs";');
        expect(staticImports).toEqual(['./a.mjs']);
    });

    it('returns empty lists for code with no imports', () => {
        expect(parseImports('const a=1')).toEqual({ staticImports: [], dynamicImports: [] });
    });
});

describe('measureEntryGraph', () => {
    it('sums the entry plus its transitive static imports', () => {
        const dist = tmpDir();
        writeChunk(dist, 'shared.mjs', 'import"./deep.mjs";', 100);
        writeChunk(dist, 'deep.mjs', '', 100);
        const entry = writeChunk(dist, 'screens/A/A.es.js', 'import"../../shared.mjs";', 100);

        expect(measureEntryGraph(entry, dist)).toEqual({ eager: 300, lazy: 0 });
    });

    it('counts dynamically imported chunks as lazy, not eager', () => {
        const dist = tmpDir();
        writeChunk(dist, 'lazy.mjs', '', 500);
        const entry = writeChunk(dist, 'screens/A/A.es.js', 'import("../../lazy.mjs")', 100);

        expect(measureEntryGraph(entry, dist)).toEqual({ eager: 100, lazy: 500 });
    });

    it('follows static imports of a lazy chunk into the lazy total', () => {
        const dist = tmpDir();
        writeChunk(dist, 'lazy.mjs', 'import"./lazy-dep.mjs";', 200);
        writeChunk(dist, 'lazy-dep.mjs', '', 300);
        const entry = writeChunk(dist, 'screens/A/A.es.js', 'import("../../lazy.mjs")', 100);

        expect(measureEntryGraph(entry, dist)).toEqual({ eager: 100, lazy: 500 });
    });

    it('counts a chunk reachable both ways as eager only', () => {
        const dist = tmpDir();
        writeChunk(dist, 'shared.mjs', '', 400);
        const entry = writeChunk(
            dist,
            'screens/A/A.es.js',
            'import"../../shared.mjs";import("../../shared.mjs")',
            100,
        );

        expect(measureEntryGraph(entry, dist)).toEqual({ eager: 500, lazy: 0 });
    });

    it('terminates on circular imports', () => {
        const dist = tmpDir();
        writeChunk(dist, 'a.mjs', 'import"./b.mjs";', 100);
        writeChunk(dist, 'b.mjs', 'import"./a.mjs";', 100);
        const entry = writeChunk(dist, 'screens/A/A.es.js', 'import"../../a.mjs";', 100);

        expect(measureEntryGraph(entry, dist)).toEqual({ eager: 300, lazy: 0 });
    });

    it('ignores bare specifiers and unresolvable paths', () => {
        const dist = tmpDir();
        const entry = writeChunk(
            dist,
            'screens/A/A.es.js',
            'import{ref}from"vue";import"./missing.mjs";',
            100,
        );

        expect(measureEntryGraph(entry, dist)).toEqual({ eager: 100, lazy: 0 });
    });

    it('ignores imports that escape distDir', () => {
        const dist = tmpDir();
        fs.writeFileSync(path.join(dist, '..', 'outside.mjs'), 'x'.repeat(999), 'utf-8');
        const entry = writeChunk(dist, 'screens/A/A.es.js', 'import"../../../outside.mjs";', 100);

        expect(measureEntryGraph(entry, dist)).toEqual({ eager: 100, lazy: 0 });
        fs.rmSync(path.join(dist, '..', 'outside.mjs'), { force: true });
    });
});

describe('measureBundle', () => {
    it('reports eager and lazy sizes per screen and component', () => {
        const dist = tmpDir();
        writeChunk(dist, 'vendor.mjs', '', 1000);
        writeChunk(dist, 'screens/Checkout/Checkout.es.js', 'import"../../vendor.mjs";', 100);
        writeChunk(dist, 'components/InvoicesList/InvoicesList.es.js', '', 50);

        const { entries } = measureBundle(dist);

        expect(entries['screens/Checkout']).toEqual({ eager: 1100, lazy: 0 });
        expect(entries['components/InvoicesList']).toEqual({ eager: 50, lazy: 0 });
    });

    it('shows a shared chunk against every entry that statically imports it', () => {
        const dist = tmpDir();
        writeChunk(dist, 'vendor.mjs', '', 1000);
        writeChunk(dist, 'screens/A/A.es.js', 'import"../../vendor.mjs";', 100);
        writeChunk(dist, 'screens/B/B.es.js', 'import"../../vendor.mjs";', 100);

        const { entries } = measureBundle(dist);

        expect(entries['screens/A'].eager).toBe(1100);
        expect(entries['screens/B'].eager).toBe(1100);
    });

    it('reports total as the on-disk size of distDir', () => {
        const dist = tmpDir();
        writeChunk(dist, 'screens/A/A.es.js', '', 100);
        writeChunk(dist, 'stray.mjs', '', 250);

        expect(measureBundle(dist).total).toBe(350);
    });

    it('returns zero sizes when an entry directory has no ESM build', () => {
        const dist = tmpDir();
        writeChunk(dist, 'screens/A/A.ce.d.ts', '', 20);

        expect(measureBundle(dist).entries['screens/A']).toEqual({ eager: 0, lazy: 0 });
    });

    it('returns empty entries when sections do not exist', () => {
        const dist = tmpDir();

        expect(measureBundle(dist)).toEqual({ total: 0, entries: {} });
    });

    // The CLI defaults to the relative `dist`; resolving imports against it must not
    // prefix the base directory twice, which would silently resolve nothing.
    it('follows imports when distDir is relative', () => {
        const dist = tmpDir();
        writeChunk(dist, 'vendor.mjs', '', 1000);
        writeChunk(dist, 'screens/A/A.es.js', 'import"../../vendor.mjs";', 100);

        const cwd = process.cwd();
        try {
            process.chdir(path.dirname(dist));
            const { entries } = measureBundle(path.basename(dist));
            expect(entries['screens/A']).toEqual({ eager: 1100, lazy: 0 });
        } finally {
            process.chdir(cwd);
        }
    });
});

describe('dirSize', () => {
    it('returns 0 when directory does not exist', () => {
        expect(dirSize(path.join(tmpDir(), 'missing'))).toBe(0);
    });

    it('recursively sums nested directories', () => {
        const dist = tmpDir();
        writeChunk(dist, 'root.js', '', 100);
        writeChunk(dist, 'sub/nested.js', '', 75);

        expect(dirSize(dist)).toBe(175);
    });
});
