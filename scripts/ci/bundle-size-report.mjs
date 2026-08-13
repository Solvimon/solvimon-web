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

const EMPTY_ENTRY = { eager: 0, lazy: 0, consumer: null };

/** Brotli bytes a consumer's bundler emits, which is what a browser actually downloads. */
function shipped(entry) {
    return entry.consumer?.brotli ?? 0;
}

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

    // Gate on the heaviest entry as a consumer's bundler ships it. Our own chunk layout is
    // an intermediate the consumer re-bundles away, so `eager` overstates what is saved and
    // `total` can move the opposite way entirely.
    const peak = (data) =>
        Object.values(data.entries).reduce((max, entry) => Math.max(max, shipped(entry)), 0);
    const prPeak = peak(pr);
    const basePeak = peak(base);

    const totalDiff = pr.total - base.total;
    const peakDiff = prPeak - basePeak;
    const alertType = peakDiff > 0 ? 'CAUTION' : peakDiff < 0 ? 'TIP' : 'NOTE';
    const summaryLines = [
        '> [!' + alertType + ']',
        summarise('Heaviest entry (shipped, brotli)', prPeak, basePeak),
        '>',
        summarise('Published package', pr.total, base.total),
    ];

    const rows = allKeys.map((key) => {
        const b = base.entries[key] ?? EMPTY_ENTRY;
        const p = pr.entries[key] ?? EMPTY_ENTRY;
        const shippedCell = p.consumer ? fmt(shipped(p)) : '—';
        const eagerCell =
            p.eager === b.eager ? fmt(p.eager) : `${fmt(p.eager)} (${delta(p.eager, b.eager)})`;
        const lazyCell =
            p.lazy === b.lazy ? fmt(p.lazy) : `${fmt(p.lazy)} (${delta(p.lazy, b.lazy)})`;
        return `| ${dot(shipped(p), shipped(b))} | \`${key}\` | ${fmt(shipped(b))} | ${shippedCell} | ${delta(shipped(p), shipped(b))} | ${eagerCell} | ${lazyCell} |`;
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
        'Shipped = the entry bundled the way a consumer imports it, brotli — the bytes a',
        'browser downloads, and the number worth acting on. Eager and lazy are the raw sizes',
        'of our own chunks, kept as diagnostics: a jump in eager against a matching drop in',
        'lazy means something stopped being dynamically imported.',
        '',
        `| | Entry | \`${baseRef}\` shipped | This PR shipped | Delta | Our eager | Our lazy |`,
        '|---|---|--:|--:|---|--:|--:|',
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
