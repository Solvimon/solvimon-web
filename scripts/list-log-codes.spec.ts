import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { scanLogCodes, buildMarkdownSection, updateReadme } from './list-log-codes.mjs';

function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'list-log-codes-'));
}

function writeFile(dir: string, name: string, content: string): string {
    const file = path.join(dir, name);
    fs.writeFileSync(file, content, 'utf-8');
    return file;
}

describe('scanLogCodes', () => {
    const dirs: string[] = [];
    afterEach(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

    function tmpDir() {
        const d = makeTmpDir();
        dirs.push(d);
        return d;
    }

    it('extracts error and warn codes from a .ts file', () => {
        const dir = tmpDir();
        writeFile(
            dir,
            'service.ts',
            `
            logger.error('REQUEST_FAILED', 'Request failed', {}, error);
            logger.warn('DEGRADED_MODE', 'Running in degraded mode');
            `,
        );

        const entries = scanLogCodes(dir, dir);

        expect(entries).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    level: 'error',
                    code: 'REQUEST_FAILED',
                    message: 'Request failed',
                }),
                expect.objectContaining({
                    level: 'warn',
                    code: 'DEGRADED_MODE',
                    message: 'Running in degraded mode',
                }),
            ]),
        );
    });

    it('extracts codes from a .vue file', () => {
        const dir = tmpDir();
        writeFile(dir, 'Component.vue', `logger.error('COMPONENT_ERROR', 'Component failed');`);

        const entries = scanLogCodes(dir, dir);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ level: 'error', code: 'COMPONENT_ERROR' });
    });

    it('does not match optional-chaining logger?.warn calls (ESLint forbids them)', () => {
        const dir = tmpDir();
        writeFile(dir, 'util.ts', `logger?.warn('OPTIONAL_WARN', 'Optional warn message');`);

        const entries = scanLogCodes(dir, dir);
        expect(entries).toHaveLength(0);
    });

    it('handles multi-line logger calls', () => {
        const dir = tmpDir();
        writeFile(
            dir,
            'multi.ts',
            `logger.error(\n    'MULTI_LINE_CODE',\n    'Multi line message',\n    {},\n    error\n);`,
        );

        const entries = scanLogCodes(dir, dir);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            code: 'MULTI_LINE_CODE',
            message: 'Multi line message',
        });
    });

    it('handles double-quoted and backtick-quoted message strings', () => {
        const dir = tmpDir();
        writeFile(
            dir,
            'quotes.ts',
            `
            logger.error('DOUBLE_QUOTE', "Double quoted message");
            logger.error('BACKTICK', \`Backtick message\`);
            `,
        );

        const entries = scanLogCodes(dir, dir);
        expect(entries).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'DOUBLE_QUOTE', message: 'Double quoted message' }),
                expect.objectContaining({ code: 'BACKTICK', message: 'Backtick message' }),
            ]),
        );
    });

    it('truncates template literal messages at the interpolation boundary and adds …', () => {
        const dir = tmpDir();
        writeFile(dir, 'template.ts', "logger.error('DYNAMIC_MSG', `invalid value: ${value}`);");

        const entries = scanLogCodes(dir, dir);
        expect(entries[0].message).toBe('invalid value:…');
    });

    it('deduplicates: keeps only the first occurrence of a code', () => {
        const dir = tmpDir();
        writeFile(
            dir,
            'dup.ts',
            `
            logger.error('DUPE_CODE', 'First message');
            logger.error('DUPE_CODE', 'Second message');
            `,
        );

        const entries = scanLogCodes(dir, dir);
        expect(entries).toHaveLength(1);
        expect(entries[0].message).toBe('First message');
    });

    it('ignores .spec. files', () => {
        const dir = tmpDir();
        writeFile(dir, 'service.spec.ts', `logger.error('SPEC_ONLY', 'should be ignored');`);

        const entries = scanLogCodes(dir, dir);
        expect(entries).toHaveLength(0);
    });

    it('ignores non-.ts/.vue files', () => {
        const dir = tmpDir();
        writeFile(dir, 'notes.md', `logger.error('MD_CODE', 'should be ignored');`);
        writeFile(dir, 'config.json', `"logger.error('JSON_CODE', 'nope')"`);

        const entries = scanLogCodes(dir, dir);
        expect(entries).toHaveLength(0);
    });

    it('scans subdirectories recursively', () => {
        const dir = tmpDir();
        const sub = path.join(dir, 'nested', 'deep');
        fs.mkdirSync(sub, { recursive: true });
        writeFile(sub, 'deep.ts', `logger.error('DEEP_CODE', 'Deep nested');`);

        const entries = scanLogCodes(dir, dir);
        expect(entries).toHaveLength(1);
        expect(entries[0].code).toBe('DEEP_CODE');
    });

    it('returns entries sorted: errors before warns, then alphabetically by code', () => {
        const dir = tmpDir();
        writeFile(
            dir,
            'mixed.ts',
            `
            logger.warn('ZEBRA_WARN', 'Z warn');
            logger.error('ZETA_ERROR', 'Z error');
            logger.warn('ALPHA_WARN', 'A warn');
            logger.error('ALPHA_ERROR', 'A error');
            `,
        );

        const entries = scanLogCodes(dir, dir);
        expect(entries.map((e) => e.code)).toEqual([
            'ALPHA_ERROR',
            'ZETA_ERROR',
            'ALPHA_WARN',
            'ZEBRA_WARN',
        ]);
    });

    it('returns an empty array when no logger calls are found', () => {
        const dir = tmpDir();
        writeFile(dir, 'clean.ts', `const x = 1;`);

        expect(scanLogCodes(dir, dir)).toEqual([]);
    });

    it('throws when srcDir escapes the baseDir', () => {
        const dir = tmpDir();
        expect(() => scanLogCodes('/etc/passwd', dir)).toThrow(/traversal/i);
    });
});

describe('buildMarkdownSection', () => {
    it('generates a section with error and warn tables', () => {
        const entries = [
            { level: 'error', code: 'REQUEST_FAILED', message: 'Request failed', file: 'a.ts' },
            { level: 'warn', code: 'DEGRADED_MODE', message: 'Degraded mode', file: 'b.ts' },
        ];

        const section = buildMarkdownSection(entries);

        expect(section).toContain('## Error logging');
        expect(section).toContain('### Error codes');
        expect(section).toContain('`REQUEST_FAILED`');
        expect(section).toContain('Request failed');
        expect(section).toContain('### Warning codes');
        expect(section).toContain('`DEGRADED_MODE`');
        expect(section).toContain('Degraded mode');
    });

    it('omits the Warning codes section when there are no warnings', () => {
        const entries = [{ level: 'error', code: 'ONLY_ERROR', message: 'An error', file: 'a.ts' }];

        const section = buildMarkdownSection(entries);

        expect(section).toContain('### Error codes');
        expect(section).not.toContain('### Warning codes');
    });

    it('omits the Error codes section when there are no errors', () => {
        const entries = [{ level: 'warn', code: 'ONLY_WARN', message: 'A warning', file: 'a.ts' }];

        const section = buildMarkdownSection(entries);

        expect(section).not.toContain('### Error codes');
        expect(section).toContain('### Warning codes');
    });

    it('produces an empty-table section when entries is empty', () => {
        const section = buildMarkdownSection([]);
        expect(section).toContain('## Error logging');
        expect(section).not.toContain('###');
    });
});

describe('updateReadme', () => {
    const dirs: string[] = [];
    afterEach(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

    function tmpReadme(content: string): string {
        const dir = makeTmpDir();
        dirs.push(dir);
        return writeFile(dir, 'README.md', content);
    }

    it('appends the section with markers when no markers exist yet', () => {
        const readme = tmpReadme('# My SDK\n\nSome content.\n');

        const result = updateReadme(
            readme,
            '## Error logging\n\nTable here.',
            path.dirname(readme),
        );

        expect(result).toBe('appended');
        const content = fs.readFileSync(readme, 'utf-8');
        expect(content).toContain('<!-- log-codes:start — DO NOT EDIT: auto-generated by `npm run logs:list` -->');
        expect(content).toContain('## Error logging');
        expect(content).toContain('<!-- log-codes:end — DO NOT EDIT: auto-generated by `npm run logs:list` -->');
        expect(content).toMatch(/Some content\.\n/);
    });

    it('replaces the existing section when markers are already present', () => {
        const readme = tmpReadme(
            '# My SDK\n\n<!-- log-codes:start — DO NOT EDIT: auto-generated by `npm run logs:list` -->\n## Error logging\n\nOld content.\n<!-- log-codes:end — DO NOT EDIT: auto-generated by `npm run logs:list` -->\n',
        );

        const result = updateReadme(
            readme,
            '## Error logging\n\nNew content.',
            path.dirname(readme),
        );

        expect(result).toBe('updated');
        const content = fs.readFileSync(readme, 'utf-8');
        expect(content).toContain('New content.');
        expect(content).not.toContain('Old content.');
        expect(content.split('<!-- log-codes:start — DO NOT EDIT: auto-generated by `npm run logs:list` -->').length - 1).toBe(1);
        expect(content.split('<!-- log-codes:end — DO NOT EDIT: auto-generated by `npm run logs:list` -->').length - 1).toBe(1);
    });

    it('is idempotent: running twice produces the same output', () => {
        const readme = tmpReadme('# My SDK\n');
        const section = '## Error logging\n\nContent.';
        const baseDir = path.dirname(readme);

        updateReadme(readme, section, baseDir);
        updateReadme(readme, section, baseDir);

        const content = fs.readFileSync(readme, 'utf-8');
        expect(content.split('<!-- log-codes:start — DO NOT EDIT: auto-generated by `npm run logs:list` -->').length - 1).toBe(1);
    });

    it('preserves content before and after the markers on update', () => {
        const readme = tmpReadme(
            'Before.\n\n<!-- log-codes:start — DO NOT EDIT: auto-generated by `npm run logs:list` -->\nOld.\n<!-- log-codes:end — DO NOT EDIT: auto-generated by `npm run logs:list` -->\n\nAfter.\n',
        );

        updateReadme(readme, 'New.', path.dirname(readme));

        const content = fs.readFileSync(readme, 'utf-8');
        expect(content).toContain('Before.');
        expect(content).toContain('After.');
        expect(content).toContain('New.');
    });

    it('throws when readmePath escapes the baseDir', () => {
        const dir = makeTmpDir();
        dirs.push(dir);
        expect(() => updateReadme('/etc/passwd', 'content', dir)).toThrow(/traversal/i);
    });
});
