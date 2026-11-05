import { describe, it, expect } from 'vitest';
import { budgetProblems, updatedBudget } from './check-bundle-budget.mjs';

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

    it('refuses an entry that measures nothing, as one that was not measured', () => {
        expect(
            budgetProblems(sizes({ 'screens/Checkout': 0 }), { 'screens/Checkout': 10 }),
        ).toEqual(['screens/Checkout could not be measured']);
    });

    it('refuses an entry that could not be measured', () => {
        expect(
            budgetProblems(sizes({ 'screens/Checkout': null }), { 'screens/Checkout': 10 }),
        ).toEqual(['screens/Checkout could not be measured']);
    });
});

describe('updatedBudget', () => {
    it('gives every entry five percent above its size, rounded up to 100 bytes, when there is no budget', () => {
        expect(
            updatedBudget(sizes({ 'screens/Checkout': 126363, 'components/Invoice': 1000 })),
        ).toEqual({
            'components/Invoice': 1100,
            'screens/Checkout': 132700,
        });
    });

    it('raises only the caps that are exceeded or missing, and keeps the rest as they are', () => {
        expect(
            updatedBudget(sizes({ over: 2000, within: 1040, missing: 500 }), {
                over: 1500,
                within: 1050,
            }),
        ).toEqual({ missing: 600, over: 2100, within: 1050 });
    });

    it('drops the cap of an entry that is no longer built', () => {
        expect(updatedBudget(sizes({ kept: 10 }), { kept: 100, gone: 100 })).toEqual({ kept: 100 });
    });

    it('keeps the cap of an entry that could not be measured this time', () => {
        expect(updatedBudget(sizes({ unmeasured: null }), { unmeasured: 100 })).toEqual({
            unmeasured: 100,
        });
        expect(updatedBudget(sizes({ unmeasured: null }))).toEqual({});
    });

    it('sorts the entries by name', () => {
        expect(Object.keys(updatedBudget(sizes({ b: 1, a: 1 })))).toEqual(['a', 'b']);
    });
});
