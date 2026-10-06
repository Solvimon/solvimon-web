import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { generateTranslationsReport } from './translations-report.mjs';

let tmpDir: string;
let defaultArgs: { translationsDir: string; sha: string };

// The report walks a real translations directory, so each case lays one out on
// disk; a locale left unwritten stands in for a missing locale file.
function setup({
    source,
    supported,
    locales,
}: {
    source: Record<string, string>;
    supported: string[];
    locales: Record<string, Record<string, string>>;
}) {
    writeSource(source);
    supported.forEach((locale) => writeLocale(locale, locales[locale] ?? {}));
    return { supported };
}

function writeSource(source: Record<string, string>) {
    writeFileSync(path.join(tmpDir, 'source.json'), JSON.stringify(source));
}

function writeLocale(locale: string, translations: Record<string, string>) {
    writeFileSync(path.join(tmpDir, 'locales', `${locale}.json`), JSON.stringify(translations));
}

describe('generateTranslationsReport', () => {
    beforeEach(() => {
        tmpDir = mkdtempSync(path.join(tmpdir(), 'translations-report-'));
        mkdirSync(path.join(tmpDir, 'locales'));
        defaultArgs = { translationsDir: tmpDir, sha: 'abc1234' };
    });

    afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

    it('includes the translations-report marker', () => {
        const { supported } = setup({ source: {}, supported: ['en-US'], locales: { 'en-US': {} } });

        expect(generateTranslationsReport({ ...defaultArgs, supported })).toContain(
            '<!-- translations-report -->',
        );
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

        expect(generateTranslationsReport({ ...defaultArgs, supported })).toContain(
            '2 keys missing',
        );
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
        writeSource({ greeting: 'Hello' });

        const report = generateTranslationsReport({ ...defaultArgs, supported: ['nl-NL'] });

        expect(report).toContain('`greeting`');
    });

    it('includes the SHA in the footer', () => {
        const { supported } = setup({ source: {}, supported: ['en-US'], locales: { 'en-US': {} } });

        expect(
            generateTranslationsReport({ ...defaultArgs, supported, sha: 'deadbeef' }),
        ).toContain('Measured at deadbeef');
    });

    it('shows NOTE when source has no keys', () => {
        const { supported } = setup({
            source: {},
            supported: ['en-US', 'nl-NL'],
            locales: { 'en-US': {}, 'nl-NL': {} },
        });

        expect(generateTranslationsReport({ ...defaultArgs, supported })).toContain('> [!NOTE]');
    });
});
