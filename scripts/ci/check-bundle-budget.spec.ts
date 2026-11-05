import { describe, it, expect } from 'vitest';
import { budgetFor, budgetProblems } from './check-bundle-budget.mjs';

const sizes = (entries: Record<string, number | null>) => ({
    entries: Object.fromEntries(
        Object.entries(entries).map(([entry, brotli]) => [
            entry,
            { consumer: brotli === null ? null : { brotli } },
        ]),
    ),
});

describe('budgetProblems', () => {
    it('accepts entries at or under their budget', () => {
        expect(
            budgetProblems(sizes({ 'screens/Checkout': 1000, 'components/Invoice': 500 }), {
                'screens/Checkout': 1000,
                'components/Invoice': 600,
            }),
        ).toEqual([]);
    });

    it('refuses an entry over its budget', () => {
        expect(
            budgetProblems(sizes({ 'screens/Checkout': 1001 }), { 'screens/Checkout': 1000 }),
        ).toEqual(['screens/Checkout is 1001 B brotli, over its budget of 1000 B']);
    });

    it('refuses a new entry without a budget', () => {
        expect(budgetProblems(sizes({ 'screens/New': 10 }), {})).toEqual([
            'screens/New has no budget; add it to bundle-budget.json',
        ]);
    });

    it('refuses a budget for an entry that is no longer built', () => {
        expect(budgetProblems(sizes({}), { 'screens/Gone': 10 })).toEqual([
            'screens/Gone has a budget but is no longer built',
        ]);
    });

    it('refuses an entry that could not be measured', () => {
        expect(
            budgetProblems(sizes({ 'screens/Checkout': null }), { 'screens/Checkout': 10 }),
        ).toEqual(['screens/Checkout could not be measured']);
    });
});

describe('budgetFor', () => {
    it('allows five percent above each size, rounded up to the next 100 bytes, sorted by entry', () => {
        expect(
            budgetFor(sizes({ 'screens/Checkout': 126363, 'components/Invoice': 1000 })),
        ).toEqual({
            'components/Invoice': 1100,
            'screens/Checkout': 132700,
        });
        expect(Object.keys(budgetFor(sizes({ b: 1, a: 1 })))).toEqual(['a', 'b']);
    });

    it('leaves out entries that could not be measured', () => {
        expect(budgetFor(sizes({ 'screens/Checkout': null }))).toEqual({});
    });
});
