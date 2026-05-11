import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs');

import { readFileSync } from 'fs';
import { generateBundleSizeReport } from './bundle-size-report.mjs';

const mockReadFileSync = vi.mocked(readFileSync);

function makeSnapshot(total: number, entries: Record<string, number> = {}) {
    return { total, entries };
}

function setup({ pr, base }: { pr: ReturnType<typeof makeSnapshot>; base: ReturnType<typeof makeSnapshot> }) {
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(pr) as never);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(base) as never);
}

const defaultArgs = { prPath: '/tmp/pr.json', basePath: '/tmp/base.json', sha: 'abc1234', baseRef: 'main' };

describe('generateBundleSizeReport', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows unchanged note when bundle size is identical', () => {
        setup({ pr: makeSnapshot(1000), base: makeSnapshot(1000) });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('> [!NOTE]');
        expect(report).toContain('Bundle size unchanged');
    });

    it('shows caution when bundle size increases', () => {
        setup({ pr: makeSnapshot(1200), base: makeSnapshot(1000) });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('> [!CAUTION]');
        expect(report).toContain('**increased**');
    });

    it('shows tip when bundle size decreases', () => {
        setup({ pr: makeSnapshot(800), base: makeSnapshot(1000) });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('> [!TIP]');
        expect(report).toContain('**decreased**');
    });

    it('shows red indicator for an increased entry', () => {
        setup({
            pr: makeSnapshot(1200, { 'screens/Checkout': 1200 }),
            base: makeSnapshot(1000, { 'screens/Checkout': 1000 }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('🔴');
    });

    it('shows green indicator for a decreased entry', () => {
        setup({
            pr: makeSnapshot(800, { 'screens/Checkout': 800 }),
            base: makeSnapshot(1000, { 'screens/Checkout': 1000 }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('🟢');
    });

    it('shows neutral indicator when an entry is unchanged', () => {
        setup({
            pr: makeSnapshot(1000, { 'screens/Checkout': 1000 }),
            base: makeSnapshot(1000, { 'screens/Checkout': 1000 }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).not.toContain('🟢');
        expect(report).not.toContain('🔴');
    });

    it('includes entries present only in PR as new entries', () => {
        setup({
            pr: makeSnapshot(500, { 'screens/New': 500 }),
            base: makeSnapshot(0, {}),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('`screens/New`');
    });

    it('includes entries present only in base as removed entries', () => {
        setup({
            pr: makeSnapshot(0, {}),
            base: makeSnapshot(500, { 'screens/Old': 500 }),
        });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('`screens/Old`');
    });

    it('uses the baseRef in the column header', () => {
        setup({ pr: makeSnapshot(1000), base: makeSnapshot(1000) });

        const report = generateBundleSizeReport({ ...defaultArgs, baseRef: 'develop' });

        expect(report).toContain('`develop`');
    });

    it('includes the SHA in the footer', () => {
        setup({ pr: makeSnapshot(1000), base: makeSnapshot(1000) });

        const report = generateBundleSizeReport({ ...defaultArgs, sha: 'deadbeef' });

        expect(report).toContain('Measured at deadbeef');
    });

    it('opens the details block when bundle size changed', () => {
        setup({ pr: makeSnapshot(1200), base: makeSnapshot(1000) });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('<details open>');
    });

    it('keeps the details block closed when bundle size is unchanged', () => {
        setup({ pr: makeSnapshot(1000), base: makeSnapshot(1000) });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('<details>');
        expect(report).not.toContain('<details open>');
    });

    it('formats sizes in KB', () => {
        setup({ pr: makeSnapshot(2048), base: makeSnapshot(1024) });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('KB');
    });

    it('shows delta with sign and percentage', () => {
        setup({ pr: makeSnapshot(1100), base: makeSnapshot(1000) });

        const report = generateBundleSizeReport(defaultArgs);

        expect(report).toContain('+');
        expect(report).toContain('%');
    });
});
