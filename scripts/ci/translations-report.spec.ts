import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs');

import { readFileSync, existsSync } from 'fs';
import { generateTranslationsReport } from './translations-report.mjs';

const mockReadFileSync = vi.mocked(readFileSync);
const mockExistsSync = vi.mocked(existsSync);

function setup({
    source,
    supported,
    locales,
}: {
    source: Record<string, string>;
    supported: string[];
    locales: Record<string, Record<string, string>>;
}) {
    mockExistsSync.mockReturnValue(true as never);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(source) as never);
    supported.forEach((locale) => {
        mockReadFileSync.mockReturnValueOnce(JSON.stringify(locales[locale] ?? {}) as never);
    });
    return { supported };
}

const defaultArgs = { translationsDir: '/fake/translations', sha: 'abc1234' };

describe('generateTranslationsReport', () => {
    beforeEach(() => vi.clearAllMocks());

    it('includes the translations-report marker', () => {
        const { supported } = setup({ source: {}, supported: ['en-US'], locales: { 'en-US': {} } });

        expect(generateTranslationsReport({ ...defaultArgs, supported })).toContain('<!-- translations-report -->');
    });

    it('shows NOTE when all locales are complete', () => {
        const { supported } = setup({
            source: { greeting: 'Hello', farewell: 'Bye' },
            supported: ['en-US', 'nl-NL'],
            locales: {
                'en-US': { greeting: 'Hello', farewell: 'Bye' },
                'nl-NL': { greeting: 'Hallo', farewell: 'Dag' },
            },
        });

        const report = generateTranslationsReport({ ...defaultArgs, supported });

        expect(report).toContain('> [!NOTE]');
        expect(report).toContain('All 2 locales are fully translated ✅');
    });

    it('shows CAUTION when one locale has missing keys', () => {
        const { supported } = setup({
            source: { greeting: 'Hello', farewell: 'Bye' },
            supported: ['en-US', 'nl-NL'],
            locales: {
                'en-US': { greeting: 'Hello', farewell: 'Bye' },
                'nl-NL': { greeting: 'Hallo' },
            },
        });

        const report = generateTranslationsReport({ ...defaultArgs, supported });

        expect(report).toContain('> [!CAUTION]');
        expect(report).toContain('Missing translations in: **nl-NL**');
    });

    it('uses plural form when multiple locales have missing keys', () => {
        const { supported } = setup({
            source: { greeting: 'Hello' },
            supported: ['en-US', 'nl-NL'],
            locales: { 'en-US': {}, 'nl-NL': {} },
        });

        expect(generateTranslationsReport({ ...defaultArgs, supported })).toContain(
            'Missing translations in: **en-US**, **nl-NL**',
        );
    });

    it('lists missing keys in a details block', () => {
        const { supported } = setup({
            source: { greeting: 'Hello', farewell: 'Bye' },
            supported: ['nl-NL'],
            locales: { 'nl-NL': { greeting: 'Hallo' } },
        });

        const report = generateTranslationsReport({ ...defaultArgs, supported });

        expect(report).toContain('<details>');
        expect(report).toContain('`farewell`');
    });

    it('shows complete locale in a closed details block', () => {
        const { supported } = setup({
            source: { greeting: 'Hello' },
            supported: ['en-US'],
            locales: { 'en-US': { greeting: 'Hello' } },
        });

        const report = generateTranslationsReport({ ...defaultArgs, supported });

        expect(report).not.toContain('<details open>');
        expect(report).toContain('<details>');
        expect(report).toContain('complete ✅');
    });

    it('uses plural "keys" for multiple missing keys', () => {
        const { supported } = setup({
            source: { a: 'A', b: 'B', c: 'C' },
            supported: ['nl-NL'],
            locales: { 'nl-NL': { a: 'AA' } },
        });

        expect(generateTranslationsReport({ ...defaultArgs, supported })).toContain('2 keys missing');
    });

    it('uses singular "key" for exactly one missing key', () => {
        const { supported } = setup({
            source: { a: 'A', b: 'B' },
            supported: ['nl-NL'],
            locales: { 'nl-NL': { a: 'AA' } },
        });

        const report = generateTranslationsReport({ ...defaultArgs, supported });

        expect(report).toContain('1 key missing');
        expect(report).not.toContain('1 keys missing');
    });

    it('treats a non-existent locale file as fully missing', () => {
        mockExistsSync.mockReturnValue(false as never);
        mockReadFileSync.mockReturnValueOnce(JSON.stringify({ greeting: 'Hello' }) as never);

        const report = generateTranslationsReport({ ...defaultArgs, supported: ['nl-NL'] });

        expect(report).toContain('`greeting`');
    });

    it('includes the SHA in the footer', () => {
        const { supported } = setup({ source: {}, supported: ['en-US'], locales: { 'en-US': {} } });

        expect(generateTranslationsReport({ ...defaultArgs, supported, sha: 'deadbeef' })).toContain(
            'Measured at deadbeef',
        );
    });

    it('shows NOTE when source has no keys', () => {
        const { supported } = setup({ source: {}, supported: ['en-US', 'nl-NL'], locales: { 'en-US': {}, 'nl-NL': {} } });

        expect(generateTranslationsReport({ ...defaultArgs, supported })).toContain('> [!NOTE]');
    });
});
