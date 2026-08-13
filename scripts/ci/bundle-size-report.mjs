import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

function fmt(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}

function dot(prSize, baseSize) {
    const diff = prSize - baseSize;
    if (diff > 0) return '🔴';
    if (diff < 0) return '🟢';
    return '⚪';
}

function delta(prSize, baseSize) {
    const diff = prSize - baseSize;
    if (diff === 0) return '–';
    const pct = baseSize > 0 ? (Math.abs(diff / baseSize) * 100).toFixed(1) : '∞';
    const sign = diff > 0 ? '+' : '−';
    return `${sign}${fmt(Math.abs(diff))} (${sign}${pct}%)`;
}

const EMPTY_ENTRY = { eager: 0, lazy: 0 };

function summarise(label, prSize, baseSize) {
    const diff = prSize - baseSize;
    if (diff === 0) return `> ${label} unchanged (${fmt(prSize)})`;
    const pct = baseSize > 0 ? (Math.abs(diff / baseSize) * 100).toFixed(1) : '∞';
    const sign = diff > 0 ? '+' : '−';
    const verb = diff > 0 ? '**increased**' : '**decreased**';
    return `> ${label} ${verb} by **${fmt(Math.abs(diff))} (${sign}${pct}%)** → ${fmt(prSize)}`;
}

export function generateBundleSizeReport({ prPath, basePath, sha, baseRef }) {
    const pr = JSON.parse(readFileSync(prPath, 'utf8'));
    const base = JSON.parse(readFileSync(basePath, 'utf8'));

    const allKeys = [...new Set([...Object.keys(base.entries), ...Object.keys(pr.entries)])].sort();

    // The entry a consumer pays the most for is the number worth gating on: shrinking a
    // shared chunk shows up here, while `total` can move the other way when we trade
    // deduplication for per-entry tree-shaking.
    const peak = (data) =>
        Object.values(data.entries).reduce((max, entry) => Math.max(max, entry.eager), 0);
    const prPeak = peak(pr);
    const basePeak = peak(base);

    const totalDiff = pr.total - base.total;
    const peakDiff = prPeak - basePeak;
    const alertType = peakDiff > 0 ? 'CAUTION' : peakDiff < 0 ? 'TIP' : 'NOTE';
    const summaryLines = [
        '> [!' + alertType + ']',
        summarise('Heaviest entry (eager)', prPeak, basePeak),
        '>',
        summarise('Published package', pr.total, base.total),
    ];

    const rows = allKeys.map((key) => {
        const b = base.entries[key] ?? EMPTY_ENTRY;
        const p = pr.entries[key] ?? EMPTY_ENTRY;
        const lazyCell =
            p.lazy === b.lazy ? fmt(p.lazy) : `${fmt(p.lazy)} (${delta(p.lazy, b.lazy)})`;
        return `| ${dot(p.eager, b.eager)} | \`${key}\` | ${fmt(b.eager)} | ${fmt(p.eager)} | ${delta(p.eager, b.eager)} | ${lazyCell} |`;
    });

    return [
        '<!-- bundle-size-report -->',
        '## Bundle Size Report',
        '',
        ...summaryLines,
        '',
        peakDiff !== 0 || totalDiff !== 0 ? '<details open>' : '<details>',
        '<summary>View entries</summary>',
        '',
        'Eager = everything a consumer downloads before the component renders, including',
        'shared chunks. Lazy = reachable only via dynamic import (payment SDKs, locales).',
        '',
        `| | Entry | \`${baseRef}\` eager | This PR eager | Delta | Lazy |`,
        '|---|---|--:|--:|---|--:|',
        ...rows,
        '',
        `Published package on disk: ${fmt(base.total)} → ${fmt(pr.total)} · ${delta(pr.total, base.total)}`,
        '',
        '</details>',
        '',
        `<sub>Measured at ${sha}</sub>`,
    ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const get = (flag) => args[args.indexOf(flag) + 1];

    console.log(
        generateBundleSizeReport({
            prPath: get('--pr'),
            basePath: get('--base'),
            sha: get('--sha'),
            baseRef: get('--base-ref'),
        }),
    );
}
