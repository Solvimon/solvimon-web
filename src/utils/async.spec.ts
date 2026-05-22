import { describe, it, expect } from 'vitest';
import { createLatestGuard } from './async';

describe('createLatestGuard', () => {
    it('returns true when only one call has been made', async () => {
        const guard = createLatestGuard();
        const isLatest = guard();
        expect(isLatest()).toBe(true);
    });

    it('returns true for the most recent call', async () => {
        const guard = createLatestGuard();
        guard();
        const isLatest = guard();
        expect(isLatest()).toBe(true);
    });

    it('returns false for a superseded call', async () => {
        const guard = createLatestGuard();
        const isLatest = guard();
        guard();
        expect(isLatest()).toBe(false);
    });

    it('discards all but the last result when calls overlap', async () => {
        const guard = createLatestGuard();
        const results: number[] = [];

        const run = async (value: number, delay: number) => {
            const isLatest = guard();
            await new Promise((resolve) => setTimeout(resolve, delay));
            if (isLatest()) results.push(value);
        };

        await Promise.all([
            run(1, 20),
            run(2, 10),
            run(3, 5),
        ]);

        expect(results).toEqual([3]);
    });

    it('independent guards do not interfere with each other', () => {
        const guardA = createLatestGuard();
        const guardB = createLatestGuard();

        const isLatestA = guardA();
        guardB();
        guardB();

        expect(isLatestA()).toBe(true);
    });
});
