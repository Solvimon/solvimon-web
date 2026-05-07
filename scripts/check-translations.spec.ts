import { describe, it, expect } from 'vitest';
import {
    isTranslationRecord,
    parseTranslationFile,
    checkTranslations,
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
        const files: Record<string, object> = { 'nl.json': { greeting: 'Hallo', farewell: 'Dag', error: 'Fout' }, 'de.json': { greeting: 'Hallo' } };
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
});
