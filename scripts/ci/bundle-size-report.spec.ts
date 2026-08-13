import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs');

import { readFileSync } from 'fs';
import { generateBundleSizeReport } from './bundle-size-report.mjs';

const mockReadFileSync = vi.mocked(readFileSync);

type Entry = { eager: number; lazy: number };

function entry(eager: number, lazy = 0): Entry {
    return { eager, lazy };
}

function makeSnapshot(total: number, entries: Record<string, Entry> = {}) {
    return { total, entries };
}

function setup({
    pr,
    base,
}: {
    pr: ReturnType<typeof makeSnapshot>;
    base: ReturnType<typeof makeSnapshot>;
}) {
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(pr) as never);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(base) as never);
}

const defaultArgs = {
    prPath: '/tmp/pr.json',
    basePath: '/tmp/base.json',
    sha: 'abc1234',
    baseRef: 'main',
};

describe('generateBundleSizeReport', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows unchanged note when the heaviest entry is identical', () => {
        setup({
            pr: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
            base: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('> [!NOTE]');
        expect(report).toContain('Heaviest entry (eager) unchanged');
    });

    it('shows caution when the heaviest entry grows', () => {
        setup({
            pr: makeSnapshot(1200, { 'screens/Checkout': entry(1200) }),
            base: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('> [!CAUTION]');
        expect(report).toContain('**increased**');
    });

    it('shows tip when the heaviest entry shrinks', () => {
        setup({
            pr: makeSnapshot(1000, { 'screens/Checkout': entry(800) }),
            base: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('> [!TIP]');
        expect(report).toContain('**decreased**');
    });

    // Dropping a shared vendor chunk trades duplication on disk for per-entry
    // tree-shaking, so the headline must follow the entry, not the package.
    it('stays a tip when entries shrink even though the package grows', () => {
        setup({
            pr: makeSnapshot(1200, { 'screens/Checkout': entry(800) }),
            base: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('> [!TIP]');
        expect(report).toContain('Published package **increased**');
    });

    it('reports the heaviest entry rather than the sum of entries', () => {
        setup({
            pr: makeSnapshot(1000, { 'screens/A': entry(300), 'screens/B': entry(900) }),
            base: makeSnapshot(1000, { 'screens/A': entry(300), 'screens/B': entry(900) }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('Heaviest entry (eager) unchanged (900 B)');
    });

    it('shows red indicator for an increased entry', () => {
        setup({
            pr: makeSnapshot(1200, { 'screens/Checkout': entry(1200) }),
            base: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
        });

        expect(generateBundleSizeReport(defaultArgs)).toContain('🔴');
    });

    it('shows green indicator for a decreased entry', () => {
        setup({
            pr: makeSnapshot(800, { 'screens/Checkout': entry(800) }),
            base: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
        });

        expect(generateBundleSizeReport(defaultArgs)).toContain('🟢');
    });

    it('shows neutral indicator when an entry is unchanged', () => {
        setup({
            pr: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
            base: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).not.toContain('🟢');
        expect(report).not.toContain('🔴');
    });

    it('shows the lazy size for an entry', () => {
        setup({
            pr: makeSnapshot(1000, { 'screens/Checkout': entry(1000, 2048) }),
            base: makeSnapshot(1000, { 'screens/Checkout': entry(1000, 2048) }),
        });

        expect(generateBundleSizeReport(defaultArgs)).toContain('2.0 KB');
    });

    // Making a lazy dependency eager is the regression this column exists to catch.
    it('shows a delta on the lazy column when lazy size changes', () => {
        setup({
            pr: makeSnapshot(1000, { 'screens/Checkout': entry(3000, 0) }),
            base: makeSnapshot(1000, { 'screens/Checkout': entry(1000, 2000) }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('−2.0 KB (−100.0%)');
    });

    it('includes entries present only in PR as new entries', () => {
        setup({ pr: makeSnapshot(500, { 'screens/New': entry(500) }), base: makeSnapshot(0, {}) });

        expect(generateBundleSizeReport(defaultArgs)).toContain('`screens/New`');
    });

    it('includes entries present only in base as removed entries', () => {
        setup({ pr: makeSnapshot(0, {}), base: makeSnapshot(500, { 'screens/Old': entry(500) }) });

        expect(generateBundleSizeReport(defaultArgs)).toContain('`screens/Old`');
    });

    it('uses the baseRef in the column header', () => {
        setup({ pr: makeSnapshot(1000), base: makeSnapshot(1000) });

        expect(generateBundleSizeReport({ ...defaultArgs, baseRef: 'develop' })).toContain(
            '`develop`',
        );
    });

    it('includes the SHA in the footer', () => {
        setup({ pr: makeSnapshot(1000), base: makeSnapshot(1000) });

        expect(generateBundleSizeReport({ ...defaultArgs, sha: 'deadbeef' })).toContain(
            'Measured at deadbeef',
        );
    });

    it('opens the details block when sizes changed', () => {
        setup({
            pr: makeSnapshot(1200, { 'screens/Checkout': entry(1200) }),
            base: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
        });

        expect(generateBundleSizeReport(defaultArgs)).toContain('<details open>');
    });

    it('keeps the details block closed when nothing changed', () => {
        setup({
            pr: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
            base: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('<details>');
        expect(report).not.toContain('<details open>');
    });

    it('reports the published package size alongside the entry table', () => {
        setup({
            pr: makeSnapshot(2048, { 'screens/Checkout': entry(1000) }),
            base: makeSnapshot(1024, { 'screens/Checkout': entry(1000) }),
        });

        expect(generateBundleSizeReport(defaultArgs)).toContain(
            'Published package on disk: 1.0 KB → 2.0 KB · +1.0 KB (+100.0%)',
        );
    });

    it('shows delta with sign and percentage', () => {
        setup({
            pr: makeSnapshot(1100, { 'screens/Checkout': entry(1100) }),
            base: makeSnapshot(1000, { 'screens/Checkout': entry(1000) }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('+');
        expect(report).toContain('%');
    });
});
