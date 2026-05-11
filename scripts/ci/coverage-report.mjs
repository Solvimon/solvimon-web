import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

function pct(val) {
    return val.toFixed(2) + '%';
}

function delta(prPct, basePct) {
    const diff = prPct - basePct;
    if (Math.abs(diff) < 0.01) return '–';
    const sign = diff > 0 ? '+' : '';
    return sign + diff.toFixed(2) + '%';
}

function dot(prPct, basePct) {
    const diff = prPct - basePct;
    if (diff > 0.01) return '🟢';
    if (diff < -0.01) return '🔴';
    return '⚪';
}

export function generateCoverageReport({ prPath, basePath, sha, baseRef }) {
    const pr = JSON.parse(readFileSync(prPath, 'utf8'));
    const base = existsSync(basePath) ? JSON.parse(readFileSync(basePath, 'utf8')) : null;

    const metrics = ['lines', 'branches', 'functions', 'statements'];

    const rows = metrics.map((m) => {
        const p = pr.total[m].pct;
        if (!base) return `| ⚪ | **${m[0].toUpperCase() + m.slice(1)}** | – | ${pct(p)} | – |`;
        const b = base.total[m].pct;
        return `| ${dot(p, b)} | **${m[0].toUpperCase() + m.slice(1)}** | ${pct(b)} | ${pct(p)} | ${delta(p, b)} |`;
    });

    let summaryLines;
    if (!base) {
        summaryLines = ['> [!NOTE]', `> Line coverage: **${pct(pr.total.lines.pct)}**`];
    } else {
        const diff = pr.total.lines.pct - base.total.lines.pct;
        summaryLines =
            Math.abs(diff) < 0.01
                ? ['> [!NOTE]', '> Line coverage unchanged']
                : diff > 0
                  ? ['> [!TIP]', `> Line coverage **increased** by **+${diff.toFixed(2)}%**`]
                  : ['> [!CAUTION]', `> Line coverage **decreased** by **${diff.toFixed(2)}%**`];
    }

    return [
        '<!-- coverage-report -->',
        '## Coverage Report',
        '',
        ...summaryLines,
        '',
        `| | Metric | \`${baseRef}\` | This PR | Delta |`,
        '|---|---|--:|--:|---|',
        ...rows,
        '',
        `<sub>Measured at ${sha}</sub>`,
    ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const get = (flag) => args[args.indexOf(flag) + 1];

    console.log(
        generateCoverageReport({
            prPath: get('--pr'),
            basePath: get('--base'),
            sha: get('--sha'),
            baseRef: get('--base-ref'),
        }),
    );
}
