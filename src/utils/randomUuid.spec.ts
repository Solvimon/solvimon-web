import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUuid } from './randomUuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomUuid', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('builds a version 4 UUID', () => {
        expect(randomUuid()).toMatch(UUID_V4);
    });

    it('does not repeat itself', () => {
        expect(new Set(Array.from({ length: 100 }, () => randomUuid())).size).toBe(100);
    });

    it('works where crypto.randomUUID does not exist, as on a plain-http page', () => {
        vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });

        expect(randomUuid()).toMatch(UUID_V4);
    });
});
