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

export function generateBundleSizeReport({ prPath, basePath, sha, baseRef }) {
    const pr = JSON.parse(readFileSync(prPath, 'utf8'));
    const base = JSON.parse(readFileSync(basePath, 'utf8'));

    const totalDiff = pr.total - base.total;
    const totalPct = base.total > 0 ? (Math.abs(totalDiff / base.total) * 100).toFixed(1) : '0.0';
    const totalSign = totalDiff > 0 ? '+' : '−';
    const totalSizeText = `**${fmt(Math.abs(totalDiff))} (${totalSign}${totalPct}%)**`;
    const verb = totalDiff > 0 ? '**increased**' : '**decreased**';
    const alertType = totalDiff > 0 ? 'CAUTION' : 'TIP';
    const summaryLines =
        totalDiff === 0
            ? ['> [!NOTE]', '> Bundle size unchanged']
            : ['> [!' + alertType + ']', `> Bundle size ${verb} by ${totalSizeText}`];

    const allKeys = [...new Set([...Object.keys(base.entries), ...Object.keys(pr.entries)])].sort();
    const rows = allKeys.map((key) => {
        const b = base.entries[key] ?? 0;
        const p = pr.entries[key] ?? 0;
        return `| ${dot(p, b)} | \`${key}\` | ${fmt(b)} | ${fmt(p)} | ${delta(p, b)} |`;
    });

    return [
        '<!-- bundle-size-report -->',
        '## Bundle Size Report',
        '',
        ...summaryLines,
        '',
        totalDiff !== 0 ? '<details open>' : '<details>',
        '<summary>View entries</summary>',
        '',
        `| | Entry | \`${baseRef}\` | This PR | Delta |`,
        '|---|---|--:|--:|---|',
        `| ${dot(pr.total, base.total)} | **Total** | ${fmt(base.total)} | ${fmt(pr.total)} | ${delta(pr.total, base.total)} |`,
        ...rows,
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
