import { describe, it, expect } from 'vitest';
import { sumEagerChunks } from './measure-consumer-bundle.mjs';

type Chunk = {
    type: string;
    fileName: string;
    code?: string;
    imports?: string[];
    isEntry?: boolean;
};

function chunk(fileName: string, code: string, imports: string[] = [], isEntry = false): Chunk {
    return { type: 'chunk', fileName, code, imports, isEntry };
}

describe('sumEagerChunks', () => {
    it('measures a lone entry chunk', () => {
        const result = sumEagerChunks([chunk('app.js', 'x'.repeat(100), [], true)]);

        expect(result.chunks).toBe(1);
        expect(result.raw).toBe(100);
        expect(result.brotli).toBeGreaterThan(0);
    });

    it('follows static imports transitively', () => {
        const result = sumEagerChunks([
            chunk('app.js', 'a'.repeat(10), ['shared.js'], true),
            chunk('shared.js', 'b'.repeat(20), ['deep.js']),
            chunk('deep.js', 'c'.repeat(30)),
        ]);

        expect(result.chunks).toBe(3);
        expect(result.raw).toBe(60);
    });

    // Dynamically imported chunks stay separate requests through the consumer's bundler,
    // so they are not part of what the entry costs up front.
    it('excludes chunks that are not statically imported', () => {
        const result = sumEagerChunks([
            chunk('app.js', 'a'.repeat(10), [], true),
            chunk('adyen.js', 'b'.repeat(5000)),
        ]);

        expect(result.chunks).toBe(1);
        expect(result.raw).toBe(10);
    });

    it('counts a shared chunk once', () => {
        const result = sumEagerChunks([
            chunk('app.js', 'a'.repeat(10), ['left.js', 'right.js'], true),
            chunk('left.js', 'b'.repeat(20), ['shared.js']),
            chunk('right.js', 'c'.repeat(20), ['shared.js']),
            chunk('shared.js', 'd'.repeat(40)),
        ]);

        expect(result.chunks).toBe(4);
        expect(result.raw).toBe(90);
    });

    it('terminates on circular imports', () => {
        const result = sumEagerChunks([
            chunk('app.js', 'a'.repeat(10), ['a.js'], true),
            chunk('a.js', 'b'.repeat(10), ['b.js']),
            chunk('b.js', 'c'.repeat(10), ['a.js']),
        ]);

        expect(result.chunks).toBe(3);
        expect(result.raw).toBe(30);
    });

    it('ignores assets and unresolvable imports', () => {
        const result = sumEagerChunks([
            chunk('app.js', 'a'.repeat(10), ['missing.js'], true),
            { type: 'asset', fileName: 'style.css' },
        ]);

        expect(result.chunks).toBe(1);
        expect(result.raw).toBe(10);
    });

    it('returns zero when there is no entry chunk', () => {
        expect(sumEagerChunks([chunk('orphan.js', 'a'.repeat(10))])).toEqual({
            raw: 0,
            brotli: 0,
            chunks: 0,
        });
    });

    it('returns zero for empty output', () => {
        expect(sumEagerChunks([])).toEqual({ raw: 0, brotli: 0, chunks: 0 });
    });
});
