import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs');

import { readdirSync, statSync } from 'fs';
import { dirSize, measureBundle } from './measure-bundle.mjs';

const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);

function file(name: string) {
    return { name, isDirectory: () => false };
}

function dir(name: string) {
    return { name, isDirectory: () => true };
}

describe('dirSize', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 0 when directory does not exist', () => {
        mockReaddirSync.mockImplementation(() => {
            throw new Error('ENOENT');
        });
        expect(dirSize('missing')).toBe(0);
    });

    it('sums file sizes in a flat directory', () => {
        mockReaddirSync.mockReturnValue([file('a.js'), file('b.js')] as never);
        mockStatSync.mockReturnValue({ size: 100 } as never);
        expect(dirSize('dist')).toBe(200);
    });

    it('recursively sums nested directories', () => {
        mockReaddirSync
            .mockReturnValueOnce([dir('sub')] as never)
            .mockReturnValueOnce([file('nested.js')] as never);
        mockStatSync.mockReturnValue({ size: 75 } as never);
        expect(dirSize('dist')).toBe(75);
    });

    it('handles mixed files and subdirectories', () => {
        mockReaddirSync
            .mockReturnValueOnce([file('root.js'), dir('sub')] as never)
            .mockReturnValueOnce([file('nested.js')] as never);
        mockStatSync.mockReturnValue({ size: 50 } as never);
        expect(dirSize('dist')).toBe(100);
    });
});

describe('measureBundle', () => {
    beforeEach(() => vi.clearAllMocks());

    function setupMock(screens: string[], components: string[], fileSize = 100) {
        mockReaddirSync.mockImplementation((path: unknown, opts: unknown) => {
            if ((opts as { withFileTypes?: boolean })?.withFileTypes) {
                return [file('index.js')] as never;
            }
            const p = String(path);
            if (p.endsWith('screens')) return screens as never;
            if (p.endsWith('components')) return components as never;
            return [] as never;
        });
        mockStatSync.mockReturnValue({ size: fileSize } as never);
    }

    it('returns per-entry sizes for screens and components', () => {
        setupMock(['Checkout', 'CustomerOverview'], ['InvoicesList']);

        const entries = measureBundle().entries as Record<string, number>;

        expect(entries['screens/Checkout']).toBe(100);
        expect(entries['screens/CustomerOverview']).toBe(100);
        expect(entries['components/InvoicesList']).toBe(100);
    });

    it('returns total dist size', () => {
        setupMock(['Checkout'], [], 200);

        const result = measureBundle();

        expect(result.total).toBe(200);
    });

    it('returns empty entries when sections do not exist', () => {
        mockReaddirSync.mockImplementation(() => {
            throw new Error('ENOENT');
        });

        const result = measureBundle();

        expect(result.entries).toEqual({});
        expect(result.total).toBe(0);
    });

    it('uses a custom distDir', () => {
        mockReaddirSync.mockImplementation((path: unknown, opts: unknown) => {
            if ((opts as { withFileTypes?: boolean })?.withFileTypes) {
                return [file('index.js')] as never;
            }
            const p = String(path);
            if (p.includes('screens')) return ['Checkout'] as never;
            if (p.includes('components')) return [] as never;
            return [] as never;
        });
        mockStatSync.mockReturnValue({ size: 50 } as never);

        const entries = measureBundle('custom-dist').entries as Record<string, number>;

        expect(entries['screens/Checkout']).toBe(50);
    });
});
