import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs');

import { readFileSync, existsSync } from 'fs';
import { generateCoverageReport } from './coverage-report.mjs';

const mockReadFileSync = vi.mocked(readFileSync);
const mockExistsSync = vi.mocked(existsSync);

function makeSummary({
    lines = 80,
    branches = 80,
    functions = 80,
    statements = 80,
}: {
    lines?: number;
    branches?: number;
    functions?: number;
    statements?: number;
} = {}) {
    return {
        total: {
            lines: { pct: lines },
            branches: { pct: branches },
            functions: { pct: functions },
            statements: { pct: statements },
        },
    };
}

function setup({ pr, base }: { pr: ReturnType<typeof makeSummary>; base?: ReturnType<typeof makeSummary> }) {
    mockExistsSync.mockReturnValue(!!base as never);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(pr) as never);
    if (base) {
        mockReadFileSync.mockReturnValueOnce(JSON.stringify(base) as never);
    }
}

const defaultArgs = { prPath: '/tmp/pr.json', basePath: '/tmp/base.json', sha: 'abc1234', baseRef: 'main' };

describe('generateCoverageReport', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows current coverage without delta when base is unavailable', () => {
        setup({ pr: makeSummary({ lines: 73.42 }) });

        const report = generateCoverageReport(defaultArgs);

        expect(report).toContain('> Line coverage: **73.42%**');
        expect(report).toContain('| – |');
        expect(report).not.toContain('increased');
        expect(report).not.toContain('decreased');
    });

    it('shows unchanged note when coverage is identical', () => {
        setup({ pr: makeSummary(), base: makeSummary() });

        const report = generateCoverageReport(defaultArgs);

        expect(report).toContain('> Line coverage unchanged');
    });

    it('shows increased tip when line coverage improves', () => {
        setup({ pr: makeSummary({ lines: 85 }), base: makeSummary({ lines: 80 }) });

        const report = generateCoverageReport(defaultArgs);

        expect(report).toContain('> [!TIP]');
        expect(report).toContain('increased');
        expect(report).toContain('+5.00%');
    });

    it('shows decreased caution when line coverage drops', () => {
        setup({ pr: makeSummary({ lines: 75 }), base: makeSummary({ lines: 80 }) });

        const report = generateCoverageReport(defaultArgs);

        expect(report).toContain('> [!CAUTION]');
        expect(report).toContain('decreased');
        expect(report).toContain('-5.00%');
    });

    it('shows green indicator for an improved metric', () => {
        setup({ pr: makeSummary({ branches: 90 }), base: makeSummary({ branches: 80 }) });

        const report = generateCoverageReport(defaultArgs);

        expect(report).toContain('🟢');
    });

    it('shows red indicator for a decreased metric', () => {
        setup({ pr: makeSummary({ branches: 70 }), base: makeSummary({ branches: 80 }) });

        const report = generateCoverageReport(defaultArgs);

        expect(report).toContain('🔴');
    });

    it('shows neutral indicator when a metric is unchanged', () => {
        setup({ pr: makeSummary(), base: makeSummary() });

        const report = generateCoverageReport(defaultArgs);

        expect(report).not.toContain('🟢');
        expect(report).not.toContain('🔴');
    });

    it('includes all four metrics', () => {
        setup({ pr: makeSummary(), base: makeSummary() });

        const report = generateCoverageReport(defaultArgs);

        expect(report).toContain('**Lines**');
        expect(report).toContain('**Branches**');
        expect(report).toContain('**Functions**');
        expect(report).toContain('**Statements**');
    });

    it('uses the baseRef in the column header', () => {
        setup({ pr: makeSummary(), base: makeSummary() });

        const report = generateCoverageReport({ ...defaultArgs, baseRef: 'develop' });

        expect(report).toContain('`develop`');
    });

    it('includes the SHA in the footer', () => {
        setup({ pr: makeSummary(), base: makeSummary() });

        const report = generateCoverageReport({ ...defaultArgs, sha: 'deadbeef' });

        expect(report).toContain('Measured at deadbeef');
    });

    it('treats a diff smaller than 0.01% as unchanged', () => {
        setup({ pr: makeSummary({ lines: 80.005 }), base: makeSummary({ lines: 80 }) });

        const report = generateCoverageReport(defaultArgs);

        expect(report).toContain('> Line coverage unchanged');
    });

    it('opens the details block when coverage changed', () => {
        setup({ pr: makeSummary({ lines: 85 }), base: makeSummary({ lines: 80 }) });

        const report = generateCoverageReport(defaultArgs);

        expect(report).toContain('<details open>');
    });

    it('keeps the details block closed when coverage is unchanged', () => {
        setup({ pr: makeSummary(), base: makeSummary() });

        const report = generateCoverageReport(defaultArgs);

        expect(report).toContain('<details>');
        expect(report).not.toContain('<details open>');
    });

    it('keeps the details block closed when there is no base', () => {
        setup({ pr: makeSummary() });

        const report = generateCoverageReport(defaultArgs);

        expect(report).toContain('<details>');
        expect(report).not.toContain('<details open>');
    });
});
