import { describe, it, expect } from 'vitest';
import {
    isTranslationRecord,
    parseTranslationFile,
    checkTranslations,
    findMessages,
    findDuplicateMessageIds,
} from './check-translations.mjs';

describe('isTranslationRecord', () => {
    it('returns true for a flat object with string values', () => {
        expect(isTranslationRecord({ hello: 'world', foo: 'bar' })).toBe(true);
    });

    it('returns false for an array', () => {
        expect(isTranslationRecord(['a', 'b'])).toBe(false);
    });

    it('returns false for null', () => {
        expect(isTranslationRecord(null)).toBe(false);
    });

    it('returns false when any value is not a string', () => {
        expect(isTranslationRecord({ key: 42 })).toBe(false);
        expect(isTranslationRecord({ key: null })).toBe(false);
        expect(isTranslationRecord({ key: { nested: 'value' } })).toBe(false);
    });

    it('returns true for an empty object', () => {
        expect(isTranslationRecord({})).toBe(true);
    });
});

describe('parseTranslationFile', () => {
    it('parses a valid translation JSON string', () => {
        const result = parseTranslationFile('{"greeting":"Hello"}', 'en.json');
        expect(result).toEqual({ greeting: 'Hello' });
    });

    it('throws for invalid JSON', () => {
        expect(() => parseTranslationFile('not json', 'en.json')).toThrow();
    });

    it('throws when parsed value is not a translation record', () => {
        expect(() => parseTranslationFile('["a","b"]', 'en.json')).toThrow(
            'Invalid translation file en.json',
        );
        expect(() => parseTranslationFile('{"key":42}', 'en.json')).toThrow(
            'Invalid translation file en.json',
        );
    });
});

describe('checkTranslations', () => {
    const sourceKeys = ['greeting', 'farewell', 'error'];

    it('returns empty missingKeys when locale is complete', () => {
        const readFile = () => JSON.stringify({ greeting: 'Hi', farewell: 'Bye', error: 'Oops' });
        const results = checkTranslations(sourceKeys, ['nl.json'], readFile);
        expect(results).toEqual([{ file: 'nl.json', missingKeys: [] }]);
    });

    it('reports missing keys', () => {
        const readFile = () => JSON.stringify({ greeting: 'Hallo' });
        const results = checkTranslations(sourceKeys, ['nl.json'], readFile);
        expect(results[0].missingKeys).toEqual(['farewell', 'error']);
    });

    it('handles multiple locale files', () => {
        const files: Record<string, object> = {
            'nl.json': { greeting: 'Hallo', farewell: 'Dag', error: 'Fout' },
            'de.json': { greeting: 'Hallo' },
        };
        const readFile = (f: string) => JSON.stringify(files[f]);
        const results = checkTranslations(sourceKeys, ['nl.json', 'de.json'], readFile);

        expect(results[0].missingKeys).toEqual([]);
        expect(results[1].missingKeys).toEqual(['farewell', 'error']);
    });

    it('throws when a locale file contains invalid JSON structure', () => {
        const readFile = () => '["not","an","object"]';
        expect(() => checkTranslations(sourceKeys, ['nl.json'], readFile)).toThrow(
            'Invalid translation file nl.json',
        );
    });

    it('returns empty missingKeys for all locales when source has no keys', () => {
        const readFile = () => JSON.stringify({ greeting: 'Hallo' });
        const results = checkTranslations([], ['nl.json', 'de.json'], readFile);
        expect(results).toEqual([
            { file: 'nl.json', missingKeys: [] },
            { file: 'de.json', missingKeys: [] },
        ]);
    });

    it('does not flag extra keys in a locale as missing', () => {
        const readFile = () =>
            JSON.stringify({ greeting: 'Hi', farewell: 'Bye', error: 'Oops', extra: 'Bonus' });
        const results = checkTranslations(sourceKeys, ['en.json'], readFile);
        expect(results[0].missingKeys).toEqual([]);
    });

    it('returns one result per locale file', () => {
        const readFile = () => JSON.stringify({});
        const results = checkTranslations(sourceKeys, ['a.json', 'b.json', 'c.json'], readFile);
        expect(results).toHaveLength(3);
    });
});

describe('findMessages', () => {
    it('reads a message declared as defaultMessage before id', () => {
        const source = `$t({ defaultMessage: 'Invoices', description: 'A title', id: 'list.title' })`;

        expect(findMessages(source)).toEqual([{ id: 'list.title', message: 'Invoices' }]);
    });

    it('reads a message declared as id before defaultMessage', () => {
        const source = `$t({ id: 'list.title', defaultMessage: 'Invoices' })`;

        expect(findMessages(source)).toEqual([{ id: 'list.title', message: 'Invoices' }]);
    });

    it('reads a message split across lines', () => {
        const source = [
            '$t({',
            '    defaultMessage:',
            "        'You will be billed {price} per {period_name}.',",
            "    id: 'checkout.description',",
            '})',
        ].join('\n');

        expect(findMessages(source)).toEqual([
            {
                id: 'checkout.description',
                message: 'You will be billed {price} per {period_name}.',
            },
        ]);
    });

    it('ignores an id that is not part of a message', () => {
        expect(findMessages(`const portal = { id: 'purl_example', url: 'https://x' };`)).toEqual(
            [],
        );
    });
});

describe('findDuplicateMessageIds', () => {
    const readFrom =
        (files: Record<string, string>) =>
        (file: string): string =>
            files[file];

    it('reports an id used for two different messages', () => {
        const files = {
            'InvoicesList.vue': `$t({ defaultMessage: 'Invoices', id: 'list.title' })`,
            'Schedules.vue': `$t({ defaultMessage: 'Schedules', id: 'list.title' })`,
        };

        expect(findDuplicateMessageIds(Object.keys(files), readFrom(files))).toEqual([
            {
                id: 'list.title',
                messages: [
                    { message: 'Invoices', file: 'InvoicesList.vue' },
                    { message: 'Schedules', file: 'Schedules.vue' },
                ],
            },
        ]);
    });

    it('reports an id used twice in one file', () => {
        const files = {
            'CheckoutTitle.vue': [
                `$t({ defaultMessage: 'per {period_name}', id: 'checkout.description' })`,
                `$t({ defaultMessage: 'billed {price} per {period_name}', id: 'checkout.description' })`,
            ].join('\n'),
        };

        const [duplicate] = findDuplicateMessageIds(Object.keys(files), readFrom(files));

        expect(duplicate.id).toBe('checkout.description');
        expect(duplicate.messages).toHaveLength(2);
    });

    it('accepts the same message reused under one id', () => {
        const files = {
            'a.vue': `$t({ defaultMessage: 'Cancel', id: 'shared.cancel' })`,
            'b.vue': `$t({ defaultMessage: 'Cancel', id: 'shared.cancel' })`,
        };

        expect(findDuplicateMessageIds(Object.keys(files), readFrom(files))).toEqual([]);
    });

    it('accepts different messages under different ids', () => {
        const files = {
            'a.vue': `$t({ defaultMessage: 'Invoices', id: 'invoices.title' })`,
            'b.vue': `$t({ defaultMessage: 'Schedules', id: 'schedules.title' })`,
        };

        expect(findDuplicateMessageIds(Object.keys(files), readFrom(files))).toEqual([]);
    });

    it('sorts the duplicates by id', () => {
        const files = {
            'a.vue': [
                `$t({ defaultMessage: 'One', id: 'z.title' })`,
                `$t({ defaultMessage: 'Two', id: 'z.title' })`,
                `$t({ defaultMessage: 'Three', id: 'a.title' })`,
                `$t({ defaultMessage: 'Four', id: 'a.title' })`,
            ].join('\n'),
        };

        expect(
            findDuplicateMessageIds(Object.keys(files), readFrom(files)).map(({ id }) => id),
        ).toEqual(['a.title', 'z.title']);
    });
});
